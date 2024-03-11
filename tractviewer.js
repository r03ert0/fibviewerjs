async function init() {
    const tck = await readTck('streamlines.50k-det.tck');
    // const tck = await readTrk('qb_F25_P2/centroids_thr-1mm_ncentroids-467.trk');
    console.log(tck);
    var    R,S,C,T;
    var uniforms;
    function initRender() {
        R = new THREE.WebGLRenderer();
        var w=window.innerWidth;
        var h=window.innerHeight;
        R.setSize(w,h);
        document.body.appendChild(R.domElement);
        S = new THREE.Scene();
        window.scene = S;
        C = new THREE.PerspectiveCamera( 75, w/h, 1, 100);
        C.position.z = 10;
        S.add(C);
        T = new THREE.TrackballControls(C,R.domElement);
        T.rotateSpeed = 5;

        // find min/max
        let min = [tck.tck[0][0][0], tck.tck[0][0][1], tck.tck[0][0][2]];
        let max = [tck.tck[0][0][0], tck.tck[0][0][1], tck.tck[0][0][2]];
        let i, j;
        for(i=0;i<tck.tck.length;i++) {
            for(j=0; j<tck.tck[i].length; j++) {
                let [x, y, z] = tck.tck[i][j];
                min[0] = (x<min[0])?x:min[0];
                min[1] = (y<min[1])?y:min[1];
                min[2] = (z<min[2])?z:min[2];
                max[0] = (x>max[0])?x:max[0];
                max[1] = (y>max[1])?y:max[1];
                max[2] = (z>max[2])?z:max[2];
            }
        }

        // add fibres
        uniforms = {
            opacity:   { type: "f", value: 0.05 },
            color:     { type: "c", value: new THREE.Color( 0xff0000 ) }
        };
        window.uniforms = uniforms;
        var shaderMaterial = new THREE.ShaderMaterial( {
            uniforms: 		uniforms,
            vertexShader:   document.getElementById( 'vertexshader' ).textContent,
            fragmentShader: document.getElementById( 'fragmentshader' ).textContent,
            blending: 		THREE.NormalBlending, //THREE.AdditiveBlending,
            depthTest:		true, // false,
            transparent:	false // true
        });
        shaderMaterial.linewidth = 1;
        for(i=0;i<tck.tck.length;i++) {
            var buffergeometry = new THREE.BufferGeometry();
            let positions=[];
            for(j=0; j<tck.tck[i].length; j += 1) {
                let [x, y, z] = tck.tck[i][j];
                x = (x-(min[0]+max[0])/2);
                y = (y-(min[1]+max[1])/2);
                z = (z-(min[2]+max[2])/2);
                positions.push(x,y,z);
            }
            buffergeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
            
            var customColor = new THREE.Float32BufferAttribute( positions.length*3, 3 );
            buffergeometry.setAttribute( 'customColor', customColor );
            var color = new THREE.Color( 0xffffff );
            for(j=0; j<tck.tck[i].length; j++) {
                color.setHSL( j/tck.tck[i].length, 0.95, 0.5 );
                color.toArray( customColor.array, j * customColor.itemSize );
            }

            S.add( new THREE.Line( buffergeometry, shaderMaterial ) );
        }
        
    }
    function render() {
        R.render(S,C);
        T.update();
    }
    function animate() {

        requestAnimationFrame(animate);
        uniforms.color.value.offsetHSL( 0.0005, 0, 0 );
        render();
    }
    initRender();
    animate();
}
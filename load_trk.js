const fs = require('fs');
const Struct = require('struct');

function readTck(path) {
    data = fs.readFileSync(path);
    let i, j, str;
    let hdr = {};
    let entry;
    j=0;
    for(i=0;i<data.length;i++) {
        if(data[i] === 10) {
            str = data.slice(j,i).toString();
            entry = str.split(/:[ ]*/);
            hdr[entry[0]] = entry[1];
            j=i+1;
            if( str === 'END') {
                break;
            }
        }
    }
    console.log(hdr);
    let count = parseInt(hdr.total_count);
    let offset = parseInt(hdr.file.split(' ')[1]);

    const s = data.slice(offset);

    let x, y, z;
    let strm = [];
    let trk = [];
    for(i=0;i<count;i++) {
        x = s.readFloatLE((3*i+0)*4);
        y = s.readFloatLE((3*i+1)*4);
        z = s.readFloatLE((3*i+2)*4);
        if(isNaN(x)) {
            trk.push(strm);
            strm = [];
            continue;
        }
        strm.push([x, y, z]);
    }

    return {hdr: hdr, tck: trk};
}

function writeTck(streamlines, path) {
    const fd = fs.openSync(path, 'w');
    let i, j, nvertices = 0;
    for(i=0;i<streamlines.length;i++) {
        nvertices += streamlines[i].length;
    }
    let hdrSize = 700;
    let hdr = [
        "mrtrix tracks",
        "init_threshold: 0.1",
        "max_angle: 9",
        "max_dist: 24",
        "max_num_seeds: 10000000",
        "max_num_tracks: " + 50000,
        "max_seed_attempts: 1000",
        "method: TensorDet",
        "min_dist: 1.2",
        "mrtrix_version: f835a76b",
        "rk4: 0",
        "source: simulation.mif",
        "step_size: 0.02",
        "stop_on_all_include: 0",
        "threshold: 0.1",
        "timestamp: 1506408029.8440241814",
        "unidirectional: 0",
        "roi: seed simulation.nii.gz",
        "roi: mask simulation.nii.gz",
        "datatype: Float32LE",
        "file: . " + hdrSize,
        "count: " + streamlines.length,
        "total_count: " + nvertices,
        "END"
    ].join("\n");
    fs.writeSync(fd, hdr);

    let offset = new Uint8Array(hdrSize - hdr.length).fill(0);
    fs.writeSync(fd, offset);

    const nanVal = Math.sqrt(-1);
    const nullVal = null;
    let floatVal = new Float32Array(3);
    for(i=0;i<streamlines.length;i++) {
        for(j=0;j<streamlines[i].length;j++) {
            floatVal[0] = streamlines[i][j][0];
            floatVal[1] = streamlines[i][j][1];
            floatVal[2] = streamlines[i][j][2];
            fs.writeSync(fd, new Buffer(floatVal.buffer));
        }
        floatVal[0] = NaN;
        floatVal[1] = NaN;
        floatVal[2] = NaN;
        fs.writeSync(fd, new Buffer(floatVal.buffer));
    }
    fs.writeSync(fd, new Buffer((new Float32Array(1).fill(null)).buffer));
    fs.closeSync(fd);
}

const TrkHdr = new Struct()
    .chars('id_string', 6)
    .array('dim', 3, 'word16Sle')
    .array('voxel_size', 3, 'floatle')
    .array('origin', 3, 'floatle')
    .word16Sle('n_scalars')
    .chars('scalar_name', 200)
    .word16Sle('n_properties')
    .chars('property_name', 200)
    .array('vox_to_ras', 16, 'floatle')
    .chars('reserved', 444)
    .chars('voxel_order', 4)
    .chars('pad2', 4)
    .array('image_orientation_patient', 6, 'floatle')
    .chars('pad1', 2)
    .word8('invert_x')
    .word8('invert_y')
    .word8('invert_z')
    .word8('invert_xy')
    .word8('invert_yz')
    .word8('invert_zx')
    .word32Sle('n_count')
    .word32Sle('version')
    .word32Sle('hdr_size');

function readTrk(path) {
    data = fs.readFileSync(path);
    TrkHdr.allocate();
    TrkHdr._setBuff(data);
    var hdr = JSON.parse(JSON.stringify(TrkHdr.fields));
    console.log(hdr);

    // read tractography
    s = data.slice(hdr.hdr_size);
    console.log(`n_count=${hdr.n_count}`);
    let i, j, k, l, n;
    i = 0;
    let trk = [];
    for(j=0;j<hdr.n_count;j++) {
        let pr = [];
        let strm=[];

        // read number of vertices in streamline
        n = s.readUInt32LE((i++)*4);

        // read streamline
        for(k=0;k<n;k++) {
            // read x, y and z coordinates of vertices
            strm.push([
                s.readFloatLE((i++)*4),
                s.readFloatLE((i++)*4),
                s.readFloatLE((i++)*4)
            ]);
            // read vertex properties
            for(l=0;l<hdr.n_properties; l++) {
                pr.push(s.readFloatLE((i++)*4));
            }
        }

        trk.push(strm);
    }
    return {hdr: hdr, trk: trk};
}
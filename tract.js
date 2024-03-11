var TrkHdr = new Struct()
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

async function blob2data(blob) {
    return await new Promise((resolve,reject) => {
        const f = new FileReader();
        f.onload = function () {
            resolve(f.result);
        }
        f.readAsArrayBuffer(blob);
    });
}

async function readFile(url) {
    const response = await fetch(url);
    const reader = response.body.getReader();
    const contentLengthHeader = response.headers.get('Content-Length');
    const resourceSize = parseInt(contentLengthHeader, 10);
    var chunks = [];
    let progress;
    async function read(reader, totalChunkSize = 0, chunkCount = 0) {
      const res = await reader.read();
      if (res.done) {
        return {total: totalChunkSize, chunkCount: chunkCount};
      }
      chunks.push(res.value);
      const runningTotal = totalChunkSize + res.value.length;
      progress = `${parseInt(runningTotal/1024/1024)} Mb (${chunkCount} chunks)`;
      document.getElementById('prog').innerHTML = progress;
      return read(reader, runningTotal, chunkCount + 1);
    }
    const {total, chunkCount} = await read(reader);
    progress = `Received ${parseInt(total/1024/1024)} Mb (${chunkCount} chunks)`;
    document.getElementById('prog').innerHTML = progress

    return blob2data(new Blob(chunks));
}

async function readTck(url) {
    const data = await readFile(url);

    // parse header
    let i, j, str;
    let hdr = {};
    let entry;
    let dv = new DataView(data);
    let dec = new TextDecoder();
    j=0;
    for(i=0;i<dv.byteLength;i++) {
        if(dv.getUint8(i) === 10) { // 10 is the ascii code for '\n'
            str = dec.decode(data.slice(j,i));
            entry = str.split(/:[ ]*/);
            hdr[entry[0]] = entry[1];
            j=i+1;
            if( str === 'END') {
                break;
            }
        }
    }
    let count = parseInt(hdr.count);
    let offset = hdr.file.split(' ')[1];

    // parse tractography
    const s = new Float32Array(data.slice(offset));
    let x, y, z;
    let strm = [];
    let tck = [];
    for(i=0;i<s.length;i+=3) {
        x = s[i+0];
        y = s[i+1];
        z = s[i+2];
        if(isNaN(x)) {
            tck.push(strm);
            strm = [];
            progress = `Reading ${tck.length} streamlines out of ${count}`;
            document.getElementById('prog').innerHTML = progress;
        } else {
            strm.push([x, y, z]);
        }
    }

    return {hdr: hdr, tck: tck};
}

async function readTrk(url) {
    const data = await readFile(url);

    // parse header
    TrkHdr.allocate();
    TrkHdr._setBuff(toBuffer(data));
    var hdr = JSON.parse(JSON.stringify(TrkHdr.fields));

    // read tractography
    let dv = new DataView(data);
    const s = new Float32Array(data.slice(hdr.hdr_size));
    console.log(`n_count=${hdr.n_count}`);
    let i, j, k, l, n;
    i = 0;
    let trk = [];
    for(j=0;j<hdr.n_count;j++) {
        let pr = [];
        let strm=[];
        // read number of vertices in streamline
        n = dv.getUint32(hdr.hdr_size + (i++)*4, true);
        // read streamline
        for(k=0;k<n;k++) {
            // read x, y and z coordinates of vertices
            strm.push([
                s[i++],
                s[i++],
                s[i++]
            ]);
            // read vertex properties
            for(l=0;l<hdr.n_properties; l++) {
                s[i++];
            }
        }
        trk.push(strm);
    }
    return {hdr: hdr, tck: trk};
}

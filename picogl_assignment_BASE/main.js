
let canvas = document.getElementById("webgl-canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let app = PicoGL.createApp(canvas);

//let spector = new SPECTOR.Spector();
//spector.displayUI();

// -----------------------------------

function fract(x)
{
    return x - Math.floor(x);
}

function dot2(x0,y0,x1,y1)
{
    return x0*x1 + y0*y1;
}

function hash( x, y )  // replace this by something better
{
    const kx = 0.3183099; const ky = 0.3678794;
    x = x * kx + ky;
    y = y * ky + kx;

    const t = fract( x * y * (x + y) );
    return [-1.0 + 2.0 * fract( 16.0 * kx * t ), -1.0 + 2.0 * fract( 16.0 * ky * t )];
}

function noise( x, y )
{
    const ix = Math.floor( x ); const iy = Math.floor( y );
    const fx = fract( x ); const fy = fract( y );
    const ux = fx * fx * (3.0-2.0*fx); const uy = fy * fy * (3.0-2.0*fy);

    const h0 = hash( ix, iy );
    const d0 = dot2( h0[0], h0[1], fx, fy );
    const h1 = hash( ix + 1.0, iy );
    const d1 = dot2( h1[0], h1[1], fx - 1.0, fy );
    const h2 = hash( ix, iy + 1.0 );
    const d2 = dot2( h2[0], h2[1], fx, fy - 1.0 );
    const h3 = hash( ix + 1.0, iy + 1.0 );
    const d3 = dot2( h3[0], h3[1], fx - 1.0, fy - 1.0 );

    const m0 = d1 * ux + d0 * (1.0 - ux);
    const m1 = d3 * ux + d2 * (1.0 - ux);
    return m1 * uy + m0 * (1.0 - uy);
}

function noiseUV( uvx, uvy, scale )
{
    uvx *= scale; uvy *= scale;
    
    let f = 0.5 * noise( uvx, uvy ); 
    let uvx2 = uvx * 1.6 + uvy * 1.2;
    let uvy2 = uvx * -1.2 + uvy * 1.6;
    f += 0.2500 * noise( uvx2, uvy2 );
    uvx = uvx2 * 1.6 + uvy2 * 1.2;
    uvy = uvx2 * -1.2 + uvy2 * 1.6;
    f += 0.1250 * noise( uvx, uvy );
    uvx2 = uvx * 1.6 + uvy * 1.2;
    uvy2 = uvx * -1.2 + uvy * 1.6;
    f += 0.0625 * noise( uvx2, uvy2 );
    return f;
}

// -----------------------------------

const planeSubdivisions = 50;

let meshVertices = new Float32Array( planeSubdivisions * planeSubdivisions * 3 );
let meshAttrib0 = new Float32Array( planeSubdivisions * planeSubdivisions * 3 );
{
    let idx = 0;
    for( let y=0; y<planeSubdivisions; y++ )
        for( let x=0; x<planeSubdivisions; x++ )
        {
            const vx = ( x / ( planeSubdivisions - 1 ) ) * 2.0 - 1.0;
            const vy = ( y / ( planeSubdivisions - 1 ) ) * 2.0 - 1.0;

            meshVertices[idx+0] = vx;
            meshVertices[idx+1] = vy;
            meshVertices[idx+2] = 0.0;
            
            meshAttrib0[idx + 0] = noiseUV( vx * 0.5 + 0.5, vy * 0.5 + 0.5, 8.0 );
            meshAttrib0[idx + 1] = noiseUV( vx * 0.5 + 0.5, vy * 0.5 + 0.5, 4.0 );
            meshAttrib0[idx + 2] = noiseUV( vx * 0.5 + 0.5, vy * 0.5 + 0.5, 2.0 );


            idx+=3;
        }
}

let meshIndices = new Uint16Array( (planeSubdivisions - 1) * (planeSubdivisions - 1) * 2 * 3 );
{
    const numQuads = planeSubdivisions - 1;
    let idx = 0;
    for( let y=0; y<numQuads; y++ )
        for( let x=0; x<numQuads; x++ )
        {
            const i = y * planeSubdivisions + x;

            meshIndices[idx++] = i; meshIndices[idx++] = i + planeSubdivisions; meshIndices[idx++] = i + 1;
            meshIndices[idx++] = i + 1; meshIndices[idx++] = i + planeSubdivisions; meshIndices[idx++] = i + planeSubdivisions + 1;
        }
}

let vertexArray;
{
    const positions = app.createVertexBuffer( PicoGL.FLOAT, 3, meshVertices );
    const attrib0 = app.createVertexBuffer( PicoGL.FLOAT, 3, meshAttrib0 );
    const indices = app.createIndexBuffer( PicoGL.UNSIGNED_SHORT, 3, meshIndices );
    vertexArray = app.createVertexArray()
    .vertexAttributeBuffer(0, positions)
    .vertexAttributeBuffer(1, attrib0)
    .indexBuffer(indices); 
}

let shaders;
{
    const sharedShaderSource = document.getElementById("test_shared").text.trim();
    const vertexShaderSource = document.getElementById("test_vs").text.trim();
    const fragmentShaderSource = document.getElementById("test_fs").text.trim();
    shaders = app.createProgram( sharedShaderSource+vertexShaderSource, sharedShaderSource+fragmentShaderSource );
}

const uniformBuffer = app.createUniformBuffer([ PicoGL.FLOAT_MAT4, PicoGL.FLOAT_MAT4, PicoGL.FLOAT_MAT4, PicoGL.FLOAT, PicoGL.FLOAT ]);

const drawObject = app.createDrawCall( shaders, vertexArray )
    .uniformBlock("ShaderGlobals", uniformBuffer );

// -----------------------------------

const projMat = mat4.create();
// Camera perspective
mat4.perspective(projMat, Math.PI / 2, canvas.width / canvas.height, 0.1, 100.0);

const viewMat = mat4.create();
{
    // Position relative to the eyes
    const eyePosition = vec3.fromValues(0, 0.75, -10.75);
    const lookAtPos = vec3.fromValues(0, 0, 0);
    const lookUpVec = vec3.fromValues(0, 1, 0);
    mat4.lookAt(viewMat, eyePosition, lookAtPos, lookUpVec);
}

let modelMat = mat4.create(); // create by default makes an identity matrix

uniformBuffer.set(0, modelMat);
uniformBuffer.set(1, viewMat);
uniformBuffer.set(2, projMat);

// -----------------------------------

let time = 0.0;
let fxStartTime = 0.0;
const fxSpeed = 0.2;

app.drawBackfaces(); // app.cullBackfaces();
app.depthTest();
app.clearColor(0.1, 0.1, 0.1, 1.0);

const randomBetweemDecimals = data => data <= 0.5 ? data + 0.5 : data;

class CircleObject {
    
    constructor() {
        this.rotation = { X: null, Y: null, Z: null};
        this.generateRotation();
        this.scaleFactor = randomBetweemDecimals(Math.random());
        this.scale = vec3.fromValues(this.scaleFactor, this.scaleFactor, this.scaleFactor);
        this.instanceRotation = vec3.fromValues(this.rotation.X, this.rotation.Y, this.rotation.Z);
        this.draw = this.draw.bind(this);
        this.offset = 2 * randomBetweemDecimals(Math.random()) * 3.14;
    }

    generateRotation() {
        const u = Math.random();
        const v = Math.random();
        const angle1 = Math.PI * 2.0 * u;
        const angle2 = Math.acos(2.0 * v - 1.0); 
        this.rotation.X = Math.sin(angle1) * Math.cos(angle2);
        this.rotation.Y = Math.sin(angle1) * Math.sin(angle1);
        this.rotation.Z = Math.cos(angle1);
    }

    draw(time) {
        
        const rotAxis1 = vec3.fromValues(0, 1, 0);
        const translateAxisZ = vec3.fromValues(0, 0, -5);
        const numberOfCircles = 16;
        const angleToRotateY = (2 * 3.14) / numberOfCircles;

        for (let index = 0; index < numberOfCircles; index++) {
            modelMat = mat4.create();
            mat4.rotate(modelMat, modelMat, this.offset + (time * 0.2) , this.instanceRotation);
            mat4.rotateY(modelMat, modelMat, angleToRotateY * index);
            mat4.translate(modelMat, modelMat, translateAxisZ);
            mat4.scale(modelMat, modelMat, this.scale);

            uniformBuffer.set(0, modelMat);
            uniformBuffer.update(); // this signals that we finished changing values and the buffer can be sent to the GPU

            drawObject.draw();
        }

    }
}

let objects = [];
const numberOfRings = 50;

for( let i = 0; i < 10 ; ++i) {
    const circle = new CircleObject();
    objects.push(circle);
}


function frameDraw() 
{
    

    time = window.performance.now() * 0.001; // https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
    app.clear();
    
    uniformBuffer.set(3, time); // update the first slot, the float (iTime)    
    
    let fxTime = (time - fxStartTime) * fxSpeed;
    if(fxTime > 1.0)
    {
        fxStartTime = time;
        fxTime = 0.0;
    }
    uniformBuffer.set(4, fxTime);
    
    objects.forEach(el => {
        el.draw(time)
    });
    // drawMultiplesObjects(time);
    // for(let index = 0; index < numberOfCircles; index++) {
    //     modelMat = mat4.create();
    //     mat4.rotate(modelMat, modelMat, time * 0.2, rotAxis1);
    //     mat4.rotateY(modelMat, modelMat, angleToRotateY * index);
    //     mat4.translate(modelMat, modelMat, translateAxisZ);
    //     // mat4.rotateX(modelMat, modelMat, 3.14/2.0);
    
    //     uniformBuffer.set(0, modelMat);
    //     uniformBuffer.update(); // this signals that we finished changing values and the buffer can be sent to the GPU
    
    //     drawObject.draw();    
    // }
    
    requestAnimationFrame( frameDraw );

}

requestAnimationFrame( frameDraw );

/* Textured orthographic spheres. Surface coordinates, illumination and ring depth
   are computed once; only longitude advances. No WebGL dependency or audio graph.
   Maps: Solar System Scope / INOVE, CC BY 4.0; see planets/CREDITS.md. */
(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const colors = { earth: [76, 171, 255], jupiter: [241, 187, 139],
    saturn: [247, 219, 168], mars: [241, 139, 119], moon: [179, 184, 237] };
  const light = [-0.48, 0.55, 0.6848];
  const models = [];
  function loadMap(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = image.naturalWidth; c.height = image.naturalHeight;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(image, 0, 0);
          resolve({ width: c.width, height: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data });
        } catch (error) { reject(error); }
      };
      image.onerror = reject; image.src = url;
    });
  }
  // Ring normal points toward the camera. Coordinate y points upward.
  const normal = [0, 0.89, 0.456];
  const ringInner = 1.18, ringOuter = 2.12;
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  function makeModel(canvas, texture, ring) {
    const name = canvas.dataset.planet;
    const size = Math.min(360, Math.max(160, Math.round(canvas.clientWidth * Math.min(devicePixelRatio || 1, 1.5))));
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const frame = ctx.createImageData(size, size), pixels = [];
    const tilt = -0.32, ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
      const sx = ((col + 0.5) / size * 2 - 1) * 2.2;
      const sy = (1 - (row + 0.5) / size * 2) * 2.2;
      const x = ct*sx + st*sy, y = -st*sx + ct*sy;
      const r2 = x*x + y*y, z = Math.sqrt(Math.max(0, 1-r2));
      const offset = (row*size+col)*4;
      const rz = -normal[1]*y/normal[2];
      const rr = Math.hypot(x,y,rz);
      if (ring && rr > ringInner && rr < ringOuter && (r2 >= 1 || rz > z)) {
        const u = Math.min(ring.width-1, Math.floor((rr-ringInner)/(ringOuter-ringInner)*ring.width));
        const k = (Math.floor(ring.height/2)*ring.width+u)*4;
        const p = [x,y,rz], along = dot(p,light);
        const shadow = along < 0 && rr*rr-along*along < 1;
        const shade = shadow ? 0.22 : 0.94;
        for (let c=0;c<3;c++) frame.data[offset+c]=ring.data[k+c]*shade;
        frame.data[offset+3]=ring.data[k+3]*0.67;
      } else if (r2 < 1) {
        const diffuse = Math.max(0, x*light[0]+y*light[1]+z*light[2]);
        let shade = Math.pow(0.075+0.925*diffuse, 0.66);
        if (ring) {
          const p=[x,y,z], distance=-dot(normal,p)/dot(normal,light);
          if (distance > 0) {
            const hit=Math.hypot(x+light[0]*distance,y+light[1]*distance,z+light[2]*distance);
            if (hit > ringInner && hit < ringOuter) shade*=0.58;
          }
        }
        pixels.push({ offset, u: Math.atan2(x,z)/(2*Math.PI)+0.5,
          v: Math.min(texture.height-1,Math.floor((0.5-Math.asin(y)/Math.PI)*texture.height)),
          shade, rim: Math.pow(1-z,3)*diffuse*(name==='earth'?0.42:0.12) });
        frame.data[offset+3]=Math.min(1,(1-Math.sqrt(r2))*size/4.4)*174;
      } else {
        // A restrained colored atmospheric halo, with transparent empty space.
        const glow=Math.exp(-(Math.sqrt(r2)-1)*16)*0.14;
        if (glow>0.001) {
          for (let c=0;c<3;c++) frame.data[offset+c]=colors[name][c];
          frame.data[offset+3]=255*glow;
        }
      }
    }
    return { canvas, ctx, frame, pixels, texture, name };
  }
  function paint(model, seconds) {
    const { texture, frame, pixels, ctx, name } = model;
    const longitude = seconds / (name==='jupiter'?220:320);
    for (const p of pixels) {
      const col = Math.floor(((p.u+longitude)%1)*texture.width);
      const index = (p.v*texture.width+col)*4;
      for (let c=0;c<3;c++) frame.data[p.offset+c]=Math.min(255,
        texture.data[index+c]*p.shade + colors[name][c]*p.rim);
    }
    ctx.putImageData(frame,0,0);
  }
  const ringPromise=loadMap('assets/planets/saturn-ring.png');
  // Attach a rejection handler immediately, even when a globe map is unavailable.
  ringPromise.catch(()=>{});
  document.querySelectorAll('canvas[data-planet]').forEach(async canvas => {
    try {
      const name=canvas.dataset.planet;
      const [texture,ring]=await Promise.all([loadMap(`assets/planets/${name}.jpg`),
        name==='saturn'?ringPromise:Promise.resolve(null)]);
      const model=makeModel(canvas,texture,ring);
      models.push(model); paint(model,0);
    } catch (error) { console.warn('Unable to load planet surface:',canvas.dataset.planet); }
  });
  let last=0;
  function tick(now) {
    if (!document.hidden && !reducedMotion.matches && now-last>100) {
      last=now;
      for (const model of models) {
        const rect=model.canvas.getBoundingClientRect();
        if (rect.right>0 && rect.left<innerWidth && rect.bottom>0 && rect.top<innerHeight) paint(model,now/1000);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

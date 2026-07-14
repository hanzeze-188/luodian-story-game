/**
 * file:// 模式 3D 渲染器 - 完整自包含版本
 * 使用 CDN Three.js + base64 GLB 数据，无需本地服务器
 * 提供与 http 模式 Cast3D 完全兼容的接口
 */
(function(){
  if(location.protocol !== 'file:') return;
  console.log('[Cast3D-file] 初始化 file:// 模式 3D 渲染器');

  var canvas = document.getElementById('craftsman-3d');
  if(!canvas) { console.error('[Cast3D-file] canvas not found'); return; }

  /* 初始隐藏canvas，等待Three.js加载 */
  canvas.style.opacity = '0';

  /* 同步创建 Cast3D 占位接口（立即返回 isReady=false） */
  window.Cast3D = {
    get isReady(){ return false; },
    get isLoaded(){ return false; },
    get masterLoaded(){ return false; },
    get alianLoaded(){ return false; },
    get alianAvailable(){ return false; },
    get currentPreset(){ return 'wide'; },
    get orbitEnabled(){ return false; },
    show: function(){}, hide: function(){}, transitionTo: function(){}, enableOrbit: function(){}
  };

  /* 等待 CDN Three.js 加载 */
  function waitForThree(cb, timeout){
    if(window.THREE){ cb(); return; }
    var timer = setTimeout(function(){
      console.warn('[Cast3D-file] Three.js CDN 加载超时('+(timeout/1000)+'s)，使用 2D 立绘');
      /* 保持 Cast3D 占位接口，游戏会自动回退到2D */
    }, timeout);
    window.addEventListener('three-cdn-ready', function(){
      clearTimeout(timer);
      cb();
    }, {once:true});
  }

  /* GLB 解析器 */
  function parseGLBFromBase64(dataUrl, THREE){
    var b64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : dataUrl;
    var binStr = atob(b64);
    var len = binStr.length;
    var bytes = new Uint8Array(len);
    for(var i=0;i<len;i++) bytes[i] = binStr.charCodeAt(i);
    var buffer = bytes.buffer;
    var view = new DataView(buffer);
    var offset = 0;

    function r8(){ return view.getUint8(offset++); }
    function r32(){ var v=view.getUint32(offset,true); offset+=4; return v; }
    function skip(n){ offset+=n; }

    var magic = r32();
    if(magic !== 0x46546C67) throw new Error('Invalid GLB');
    var version = r32();
    var totalLen = r32();

    var jsonChunk=null, binChunk=null;
    while(offset < totalLen){
      var chunkLen = r32();
      var chunkType = r32();
      if(chunkType === 0x4E4F534A){
        var buf = buffer.slice(offset, offset+chunkLen);
        jsonChunk = JSON.parse(new TextDecoder().decode(buf));
      } else if(chunkType === 0x004E4942){
        binChunk = buffer.slice(offset, offset+chunkLen);
      }
      skip(chunkLen);
    }
    if(!jsonChunk) throw new Error('No JSON chunk');
    return buildScene(jsonChunk, binChunk, THREE);
  }

  function getAccessorData(accessors, bufferViews, binBuffer, idx){
    var acc = accessors[idx];
    var bv = bufferViews[acc.bufferView];
    var byteOff = (bv.byteOffset||0) + (acc.byteOffset||0);
    var count = acc.count;
    var type = acc.type;
    var ct = acc.componentType;
    var typeSize = {SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT3:9,MAT4:16}[type]||1;
    var compSize = {5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[ct]||4;
    var TypedArr = {5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[ct]||Float32Array;
    var result = new TypedArr(count * typeSize);
    var dv = new DataView(binBuffer);
    for(var i=0; i<count; i++){
      for(var c=0; c<typeSize; c++){
        var vo = byteOff + (i*typeSize+c)*compSize;
        var val;
        if(ct===5126) val=dv.getFloat32(vo,true);
        else if(ct===5125) val=dv.getUint32(vo,true);
        else if(ct===5123) val=dv.getUint16(vo,true);
        else if(ct===5122) val=dv.getInt16(vo,true);
        else if(ct===5121) val=dv.getUint8(vo);
        else if(ct===5120) val=dv.getInt8(vo);
        result[i*typeSize+c] = val;
      }
    }
    return {array: result, itemSize: typeSize};
  }

  function buildScene(json, binBuffer, THREE){
    var accessors = json.accessors || [];
    var bufferViews = json.bufferViews || [];
    var meshes = json.meshes || [];
    var materials = json.materials || [];
    var nodes = json.nodes || [];

    var matCache = {};
    for(var mi=0; mi<materials.length; mi++){
      var m = materials[mi];
      var pbr = m.pbrMetallicRoughness || {};
      var cf = pbr.baseColorFactor || [1,1,1,1];
      var mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cf[0], cf[1], cf[2]),
        metalness: pbr.metallicFactor !== undefined ? pbr.metallicFactor : 0,
        roughness: pbr.roughnessFactor !== undefined ? pbr.roughnessFactor : 1,
        side: THREE.DoubleSide
      });
      matCache[mi] = mat;
    }

    var meshCache = {};
    for(var i=0; i<meshes.length; i++){
      var meshDef = meshes[i];
      var prims = meshDef.primitives || [];
      var group = new THREE.Group();
      for(var pi=0; pi<prims.length; pi++){
        var prim = prims[pi];
        var attrs = prim.attributes || {};
        var geom = new THREE.BufferGeometry();
        if(attrs.POSITION !== undefined){
          var d = getAccessorData(accessors, bufferViews, binBuffer, attrs.POSITION);
          geom.setAttribute('position', new THREE.BufferAttribute(d.array, 3));
        }
        if(attrs.NORMAL !== undefined){
          var d = getAccessorData(accessors, bufferViews, binBuffer, attrs.NORMAL);
          geom.setAttribute('normal', new THREE.BufferAttribute(d.array, 3));
        }
        if(attrs.TEXCOORD_0 !== undefined){
          var d = getAccessorData(accessors, bufferViews, binBuffer, attrs.TEXCOORD_0);
          geom.setAttribute('uv', new THREE.BufferAttribute(d.array, 2));
        }
        if(prim.indices !== undefined){
          var d = getAccessorData(accessors, bufferViews, binBuffer, prim.indices);
          geom.setIndex(new THREE.BufferAttribute(d.array, 1));
        }
        var matIdx = prim.material !== undefined ? prim.material : 0;
        var mat = matCache[matIdx] || new THREE.MeshStandardMaterial({color:0xcccccc, side:THREE.DoubleSide});
        group.add(new THREE.Mesh(geom, mat));
      }
      meshCache[i] = group;
    }

    var nodeObjs = [];
    for(var ni=0; ni<nodes.length; ni++){
      var node = nodes[ni];
      var obj = new THREE.Group();
      if(node.translation) obj.position.set(node.translation[0], node.translation[1], node.translation[2]);
      if(node.rotation) obj.quaternion.set(node.rotation[0], node.rotation[1], node.rotation[2], node.rotation[3]);
      if(node.scale) obj.scale.set(node.scale[0], node.scale[1], node.scale[2]);
      if(node.mesh !== undefined && meshCache[node.mesh]){
        obj.add(meshCache[node.mesh].clone(true));
      }
      nodeObjs[ni] = obj;
    }
    for(var ci=0; ci<nodes.length; ci++){
      var node = nodes[ci];
      if(node.children){
        for(var chi=0; chi<node.children.length; chi++){
          nodeObjs[ci].add(nodeObjs[node.children[chi]]);
        }
      }
    }

    var scene = new THREE.Scene();
    var sceneNodes = json.scenes ? (json.scenes[json.scene||0].nodes||[]) : [];
    for(var si=0; si<sceneNodes.length; si++){
      scene.add(nodeObjs[sceneNodes[si]]);
    }
    return scene;
  }

  /* 主初始化 */
  waitForThree(function(){
    var THREE = window.THREE;
    if(!THREE) return;

    /* Renderer */
    var renderer = new THREE.WebGLRenderer({canvas:canvas, alpha:true, antialias:true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    /* Scene */
    var scene = new THREE.Scene();

    /* Camera */
    var camera = new THREE.PerspectiveCamera(42, window.innerWidth/window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.4, 5.5);

    /* Lights */
    scene.add(new THREE.AmbientLight(0xfff5e6, 0.6));
    var dirLight = new THREE.DirectionalLight(0xfff0d0, 1.2);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);
    var fillLight = new THREE.DirectionalLight(0xd0e0ff, 0.3);
    fillLight.position.set(-2, 2, -1);
    scene.add(fillLight);

    /* Camera presets - 与http模式保持一致 */
    var PRESETS = {
      master_full:{pos:[-0.5,-0.5,4.5],look:[-1.0,-1.75,0.5],fov:28},
      master_bust:{pos:[-0.7,-0.3,3.5],look:[-1.0,-1.45,0.5],fov:32},
      master_face:{pos:[-0.85,-0.15,2.8],look:[-1.0,-1.25,0.5],fov:36},
      master_side:{pos:[0.1,-0.4,3.8],look:[-1.0,-1.5,0.5],fov:30},
      alian_full:{pos:[0.5,-0.55,4.5],look:[1.0,-1.8,0.5],fov:28},
      alian_bust:{pos:[0.7,-0.35,3.5],look:[1.0,-1.5,0.5],fov:32},
      alian_face:{pos:[0.85,-0.2,2.8],look:[1.0,-1.3,0.5],fov:36},
      alian_side:{pos:[-0.1,-0.45,3.8],look:[1.0,-1.55,0.5],fov:30},
      wide:{pos:[0.0,-0.4,5.8],look:[0.0,-1.8,0.5],fov:36},
      two_shot:{pos:[0.0,-0.5,5.2],look:[0.0,-1.85,0.5],fov:32},
      player_pov:{pos:[0.0,-0.4,4.0],look:[0.0,-1.65,0.5],fov:42},
      oversee:{pos:[0.0,0.7,3.5],look:[0.0,-2.1,0.5],fov:34}
    };

    var curPreset = 'wide';
    var visible = false;
    var masterLoaded = false;
    var alianLoaded = false;
    var camAnim = null;
    var masterRoot = null;
    var alianRoot = null;

    function transitionTo(name, dur){
      var p = PRESETS[name];
      if(!p) return;
      curPreset = name;
      camAnim = {
        fromPos: camera.position.clone(),
        toPos: new THREE.Vector3(p.pos[0],p.pos[1],p.pos[2]),
        fromLook: new THREE.Vector3(0,1,0),
        toLook: new THREE.Vector3(p.look[0],p.look[1],p.look[2]),
        fromFov: camera.fov, toFov: p.fov,
        t:0, dur: dur||1.2
      };
    }

    function loadModel(dataVar, targetHeight, xPos, yRot, onLoad){
      var dataUrl = window[dataVar];
      if(!dataUrl){ console.warn('[Cast3D-file] 模型数据未找到:', dataVar); return; }
      try{
        var gltfScene = parseGLBFromBase64(dataUrl, THREE);
        var box = new THREE.Box3().setFromObject(gltfScene);
        var size = box.getSize(new THREE.Vector3());
        var scale = targetHeight / size.y;
        gltfScene.scale.set(scale, scale, scale);
        /* 重新计算包围盒，居中并脚底贴地 */
        var box2 = new THREE.Box3().setFromObject(gltfScene);
        var center = box2.getCenter(new THREE.Vector3());
        gltfScene.position.x -= center.x;
        gltfScene.position.y -= box2.min.y;
        gltfScene.position.z -= center.z;
        /* 放入组中控制整体位置：站在桌子后面，脚底在桌面下方 */
        var root = new THREE.Group();
        root.position.set(xPos, -2.3, 0.5);
        root.rotation.y = yRot;
        root.add(gltfScene);
        scene.add(root);
        onLoad(root);
      }catch(e){
        console.error('[Cast3D-file] 模型解析失败:', e);
      }
    }

    /* 老匠人固定在左侧：x=-1.0，面向中心（轻微右转） */
    loadModel('OLD_CRAFTSMAN_GLB_BASE64', 1.1, -1.0, Math.PI*0.18, function(root){
      masterRoot = root;
      masterLoaded = true;
      console.log('[Cast3D-file] 老匠人加载完成');
    });
    /* 阿莲固定在右侧：x=1.0，面向中心（轻微左转），与老匠人对称 */
    loadModel('ALIAN_GLB_BASE64', 1.0, 1.0, -Math.PI*0.18, function(root){
      alianRoot = root;
      alianLoaded = true;
      console.log('[Cast3D-file] 阿莲加载完成');
    });

    /* 渲染循环 */
    var lastTime = 0;
    function loop(ts){
      requestAnimationFrame(loop);
      if(!visible) return;
      if(ts - lastTime < 33) return;
      lastTime = ts;
      var t = performance.now()*0.001;

      if(camAnim){
        camAnim.t += 0.016;
        var k = Math.min(camAnim.t / camAnim.dur, 1);
        var e = k<0.5 ? 2*k*k : 1-Math.pow(-2*k+2,2)/2;
        camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, e);
        camera.fov = camAnim.fromFov + (camAnim.toFov - camAnim.fromFov)*e;
        camera.lookAt(camAnim.toLook);
        camera.updateProjectionMatrix();
        if(k>=1) camAnim = null;
      }

      if(masterRoot){
        masterRoot.rotation.z = Math.sin(t*0.4)*0.004;
      }
      if(alianRoot){
        alianRoot.rotation.z = Math.sin(t*0.45+1)*0.003;
      }

      renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);

    window.addEventListener('resize', function(){
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth/window.innerHeight;
      camera.updateProjectionMatrix();
    });

    /* 覆盖 Cast3D 接口为完整版本 */
    window.Cast3D = {
      get isReady(){ return true; },
      get isLoaded(){ return masterLoaded; },
      get masterLoaded(){ return masterLoaded; },
      get alianLoaded(){ return alianLoaded; },
      get alianAvailable(){ return alianLoaded; },
      get currentPreset(){ return curPreset; },
      get orbitEnabled(){ return false; },
      show: function(){
        visible = true;
        canvas.style.opacity = '1';
      },
      hide: function(){
        visible = false;
        canvas.style.opacity = '0';
      },
      transitionTo: transitionTo,
      enableOrbit: function(){}
    };

    console.log('[Cast3D-file] 初始化完成，等待模型加载...');
  }, 15000);
})();

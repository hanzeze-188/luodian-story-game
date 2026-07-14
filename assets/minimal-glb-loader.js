/**
 * Minimal GLB Loader for Three.js (global script mode)
 * Parses GLB binary format and creates Three.js meshes using global THREE API
 * Works without ES modules - designed for file:// protocol usage
 * 
 * Usage: 
 *   var loader = new MinimalGLBLoader();
 *   loader.parse(base64String, function(gltf) {
 *     scene.add(gltf.scene);
 *   });
 */
(function(global) {
  'use strict';

  var THREE = global.THREE;
  if (!THREE) {
    console.error('[MinimalGLBLoader] THREE not found. Load three.min.js first.');
    return;
  }

  /* Binary reader utility */
  function BinaryReader(buffer) {
    this.view = new DataView(buffer);
    this.offset = 0;
  }
  BinaryReader.prototype = {
    readUint8: function() { return this.view.getUint8(this.offset++); },
    readUint16: function() { var v = this.view.getUint16(this.offset, true); this.offset += 2; return v; },
    readUint32: function() { var v = this.view.getUint32(this.offset, true); this.offset += 4; return v; },
    readFloat32: function() { var v = this.view.getFloat32(this.offset, true); this.offset += 4; return v; },
    readString: function(len) {
      var str = '';
      for (var i = 0; i < len; i++) str += String.fromCharCode(this.readUint8());
      return str;
    },
    seek: function(pos) { this.offset = pos; },
    skip: function(n) { this.offset += n; }
  };

  /* Decode base64 to ArrayBuffer */
  function decodeBase64(b64) {
    var binStr = atob(b64.split(',')[1] || b64);
    var len = binStr.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
    return bytes.buffer;
  }

  /* Main GLB parser */
  function MinimalGLBLoader() {}
  MinimalGLBLoader.prototype = {
    parse: function(dataUrl, onLoad, onError) {
      try {
        var buffer = decodeBase64(dataUrl);
        var reader = new BinaryReader(buffer);

        /* Read GLB header */
        var magic = reader.readUint32();
        if (magic !== 0x46546C67) throw new Error('Invalid GLB');
        var version = reader.readUint32();
        var length = reader.readUint32();

        /* Read chunks */
        var jsonChunk = null, binChunk = null;
        while (reader.offset < length) {
          var chunkLen = reader.readUint32();
          var chunkType = reader.readUint32();
          if (chunkType === 0x4E4F534A) { /* JSON */
            var jsonBuf = buffer.slice(reader.offset, reader.offset + chunkLen);
            jsonChunk = JSON.parse(new TextDecoder().decode(jsonBuf));
          } else if (chunkType === 0x004E4942) { /* BIN */
            binChunk = buffer.slice(reader.offset, reader.offset + chunkLen);
          }
          reader.skip(chunkLen);
        }

        if (!jsonChunk) throw new Error('No JSON chunk');

        /* Build Three.js scene from glTF JSON */
        var scene = this._buildScene(jsonChunk, binChunk, buffer);
        onLoad({ scene: scene, scenes: [scene] });
      } catch (e) {
        console.error('[MinimalGLBLoader] Parse error:', e);
        if (onError) onError(e);
      }
    },

    _buildScene: function(json, binBuffer, fullBuffer) {
      var scene = new THREE.Scene();
      var nodes = json.nodes || [];
      var meshes = json.meshes || [];
      var materials = json.materials || [];
      var accessors = json.accessors || [];
      var bufferViews = json.bufferViews || [];
      var images = json.images || [];
      var textures = json.textures || [];

      /* Create materials */
      var matCache = {};
      for (var mi = 0; mi < materials.length; mi++) {
        var m = materials[mi];
        var pbr = m.pbrMetallicRoughness || {};
        var mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(
            (pbr.baseColorFactor || [1,1,1,1])[0],
            (pbr.baseColorFactor || [1,1,1,1])[1],
            (pbr.baseColorFactor || [1,1,1,1])[2]
          ),
          metalness: pbr.metallicFactor || 0,
          roughness: pbr.roughnessFactor || 1,
          side: THREE.DoubleSide
        });
        if (m.name) mat.name = m.name;
        matCache[mi] = mat;
      }

      /* Create meshes */
      var meshCache = {};
      for (var i = 0; i < meshes.length; i++) {
        var meshDef = meshes[i];
        var geometry = new THREE.BufferGeometry();
        var primitives = meshDef.primitives || [];

        for (var pi = 0; pi < primitives.length; pi++) {
          var prim = primitives[pi];
          var attrs = prim.attributes || {};

          /* POSITION */
          if (attrs.POSITION !== undefined) {
            var posData = this._getAccessorData(accessors, bufferViews, binBuffer, attrs.POSITION);
            geometry.setAttribute('position', new THREE.BufferAttribute(posData, 3));
          }
          /* NORMAL */
          if (attrs.NORMAL !== undefined) {
            var normData = this._getAccessorData(accessors, bufferViews, binBuffer, attrs.NORMAL);
            geometry.setAttribute('normal', new THREE.BufferAttribute(normData, 3));
          }
          /* TEXCOORD_0 */
          if (attrs.TEXCOORD_0 !== undefined) {
            var uvData = this._getAccessorData(accessors, bufferViews, binBuffer, attrs.TEXCOORD_0);
            geometry.setAttribute('uv', new THREE.BufferAttribute(uvData, 2));
          }
          /* INDICES */
          if (prim.indices !== undefined) {
            var idxData = this._getAccessorData(accessors, bufferViews, binBuffer, prim.indices);
            geometry.setIndex(new THREE.BufferAttribute(idxData, 1));
          }
        }

        geometry.computeBoundingSphere();
        var material = matCache[primitives[0].material] || new THREE.MeshStandardMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
        meshCache[i] = new THREE.Mesh(geometry, material);
      }

      /* Build node hierarchy */
      var nodeObjects = [];
      for (var ni = 0; ni < nodes.length; ni++) {
        var node = nodes[ni];
        var obj = new THREE.Group();

        if (node.translation) obj.position.set(node.translation[0], node.translation[1], node.translation[2]);
        if (node.rotation) obj.quaternion.set(node.rotation[0], node.rotation[1], node.rotation[2], node.rotation[3]);
        if (node.scale) obj.scale.set(node.scale[0], node.scale[1], node.scale[2]);

        if (node.mesh !== undefined && meshCache[node.mesh]) {
          obj.add(meshCache[node.mesh].clone());
        }

        nodeObjects[ni] = obj;
      }

      /* Link children */
      for (var ci = 0; ci < nodes.length; ci++) {
        var node = nodes[ci];
        if (node.children) {
          for (var chi = 0; chi < node.children.length; chi++) {
            nodeObjects[ci].add(nodeObjects[node.children[chi]]);
          }
        }
      }

      /* Add root nodes to scene */
      var sceneNodes = json.scenes ? (json.scenes[json.scene || 0].nodes || []) : [];
      for (var si = 0; si < sceneNodes.length; si++) {
        scene.add(nodeObjects[sceneNodes[si]]);
      }

      return scene;
    },

    _getAccessorData: function(accessors, bufferViews, binBuffer, accessorIdx) {
      var acc = accessors[accessorIdx];
      var bv = bufferViews[acc.bufferView];
      var offset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
      var count = acc.count;
      var type = acc.type;
      var componentType = acc.componentType;

      var TypedArray;
      switch (componentType) {
        case 5120: TypedArray = Int8Array; break;
        case 5121: TypedArray = Uint8Array; break;
        case 5122: TypedArray = Int16Array; break;
        case 5123: TypedArray = Uint16Array; break;
        case 5125: TypedArray = Uint32Array; break;
        case 5126: TypedArray = Float32Array; break;
        default: TypedArray = Float32Array;
      }

      var result = new TypedArray(count * this._getTypeSize(type));
      var src = new DataView(binBuffer);
      for (var i = 0; i < count; i++) {
        var srcOffset = offset + i * this._getComponentSize(componentType) * this._getTypeSize(type);
        for (var c = 0; c < this._getTypeSize(type); c++) {
          var valOffset = srcOffset + c * this._getComponentSize(componentType);
          switch (componentType) {
            case 5126: result[i * this._getTypeSize(type) + c] = src.getFloat32(valOffset, true); break;
            case 5125: result[i * this._getTypeSize(type) + c] = src.getUint32(valOffset, true); break;
            case 5123: result[i * this._getTypeSize(type) + c] = src.getUint16(valOffset, true); break;
            case 5122: result[i * this._getTypeSize(type) + c] = src.getInt16(valOffset, true); break;
            case 5121: result[i * this._getTypeSize(type) + c] = src.getUint8(valOffset); break;
            case 5120: result[i * this._getTypeSize(type) + c] = src.getInt8(valOffset); break;
          }
        }
      }
      return result;
    },

    _getTypeSize: function(type) {
      switch (type) {
        case 'SCALAR': return 1;
        case 'VEC2': return 2;
        case 'VEC3': return 3;
        case 'VEC4': return 4;
        case 'MAT3': return 9;
        case 'MAT4': return 16;
        default: return 1;
      }
    },

    _getComponentSize: function(componentType) {
      switch (componentType) {
        case 5120: case 5121: return 1;
        case 5122: case 5123: return 2;
        case 5125: case 5126: return 4;
        default: return 4;
      }
    }
  };

  global.MinimalGLBLoader = MinimalGLBLoader;
})(window);

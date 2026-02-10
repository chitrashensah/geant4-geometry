/**
 * @chitrashensah/geant4-geometry
 * Copyright (c) 2025 Chitrashen Sah
 * Licensed under MIT License
 * 
 * ============================================================================
 * CSG (Constructive Solid Geometry) Implementation
 * ============================================================================
 * 
 * Based on THREE-CSGMesh by Sean Bradley
 * https://github.com/Sean-Bradley/THREE-CSGMesh
 * 
 * Original work copyright (c) 2011 Evan Wallace (http://madebyevan.com/)
 * THREE.js rework by thrax
 * Differences Copyright 2020-2022 Sean Bradley
 * 
 * Licensed under MIT License
 * Bundled with attribution as permitted by MIT License terms
 */

import * as THREE from 'three';

/**
 * CSG - Constructive Solid Geometry
 * Holds a binary space partition tree representing a 3D solid.
 * Two solids can be combined using union(), subtract(), and intersect() methods.
 */
class CSG {
  constructor() {
    this.polygons = [];
  }

  clone() {
    const csg = new CSG();
    csg.polygons = this.polygons.map((p) => p.clone());
    return csg;
  }

  toPolygons() {
    return this.polygons;
  }

  union(csg) {
    const a = new Node(this.clone().polygons);
    const b = new Node(csg.clone().polygons);
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.build(b.allPolygons());
    return CSG.fromPolygons(a.allPolygons());
  }

  subtract(csg) {
    const a = new Node(this.clone().polygons);
    const b = new Node(csg.clone().polygons);
    a.invert();
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.build(b.allPolygons());
    a.invert();
    return CSG.fromPolygons(a.allPolygons());
  }

  intersect(csg) {
    const a = new Node(this.clone().polygons);
    const b = new Node(csg.clone().polygons);
    a.invert();
    b.clipTo(a);
    b.invert();
    a.clipTo(b);
    b.clipTo(a);
    a.build(b.allPolygons());
    a.invert();
    return CSG.fromPolygons(a.allPolygons());
  }

  inverse() {
    const csg = this.clone();
    csg.polygons.forEach((p) => p.flip());
    return csg;
  }

  static fromPolygons(polygons) {
    const csg = new CSG();
    csg.polygons = polygons;
    return csg;
  }

  static fromGeometry(geom, objectIndex) {
    let polys = [];
    const posattr = geom.attributes.position;
    const normalattr = geom.attributes.normal;
    const uvattr = geom.attributes.uv;
    const colorattr = geom.attributes.color;
    let index;

    if (geom.index) {
      index = geom.index.array;
    } else {
      index = new Array((posattr.array.length / posattr.itemSize) | 0);
      for (let i = 0; i < index.length; i++) index[i] = i;
    }

    const triCount = (index.length / 3) | 0;
    polys = new Array(triCount);

    for (let i = 0, pli = 0, l = index.length; i < l; i += 3, pli++) {
      const vertices = new Array(3);
      for (let j = 0; j < 3; j++) {
        const vi = index[i + j];
        const vp = vi * 3;
        const vt = vi * 2;
        const x = posattr.array[vp];
        const y = posattr.array[vp + 1];
        const z = posattr.array[vp + 2];
        const nx = normalattr.array[vp];
        const ny = normalattr.array[vp + 1];
        const nz = normalattr.array[vp + 2];

        vertices[j] = new Vertex(
          { x, y, z },
          { x: nx, y: ny, z: nz },
          uvattr && { x: uvattr.array[vt], y: uvattr.array[vt + 1], z: 0 },
          colorattr && { 
            x: colorattr.array[vt], 
            y: colorattr.array[vt + 1], 
            z: colorattr.array[vt + 2] 
          }
        );
      }
      polys[pli] = new Polygon(vertices, objectIndex);
    }
    return CSG.fromPolygons(polys);
  }

  static fromMesh(mesh, objectIndex) {
    const csg = CSG.fromGeometry(mesh.geometry, objectIndex);
    CSG.tmpm3.getNormalMatrix(mesh.matrix);
    for (let i = 0; i < csg.polygons.length; i++) {
      const p = csg.polygons[i];
      for (let j = 0; j < p.vertices.length; j++) {
        const v = p.vertices[j];
        v.pos.copy(
          CSG.ttvv0
            .copy(new THREE.Vector3(v.pos.x, v.pos.y, v.pos.z))
            .applyMatrix4(mesh.matrix)
        );
        v.normal.copy(
          CSG.ttvv0
            .copy(new THREE.Vector3(v.normal.x, v.normal.y, v.normal.z))
            .applyMatrix3(CSG.tmpm3)
        );
      }
    }
    return csg;
  }

  static nbuf3(ct) {
    return {
      top: 0,
      array: new Float32Array(ct),
      write: function (v) {
        this.array[this.top++] = v.x;
        this.array[this.top++] = v.y;
        this.array[this.top++] = v.z;
      },
    };
  }

  static nbuf2(ct) {
    return {
      top: 0,
      array: new Float32Array(ct),
      write: function (v) {
        this.array[this.top++] = v.x;
        this.array[this.top++] = v.y;
      },
    };
  }

  static toGeometry(csg) {
    const ps = csg.polygons;
    let triCount = 0;
    ps.forEach((p) => (triCount += p.vertices.length - 2));

    const geom = new THREE.BufferGeometry();
    const vertices = CSG.nbuf3(triCount * 3 * 3);
    const normals = CSG.nbuf3(triCount * 3 * 3);
    let uvs;
    let colors;
    const grps = {};

    ps.forEach((p) => {
      const pvs = p.vertices;
      const pvlen = pvs.length;
      if (p.shared !== undefined) {
        if (!grps[p.shared]) grps[p.shared] = [];
      }
      if (pvlen) {
        if (pvs[0].color !== undefined) {
          if (!colors) colors = CSG.nbuf3(triCount * 3 * 3);
        }
        if (pvs[0].uv !== undefined) {
          if (!uvs) uvs = CSG.nbuf2(triCount * 2 * 3);
        }
      }
      for (let j = 3; j <= pvlen; j++) {
        p.shared !== undefined &&
          grps[p.shared].push(
            vertices.top / 3,
            vertices.top / 3 + 1,
            vertices.top / 3 + 2
          );
        vertices.write(pvs[0].pos);
        vertices.write(pvs[j - 2].pos);
        vertices.write(pvs[j - 1].pos);
        normals.write(pvs[0].normal);
        normals.write(pvs[j - 2].normal);
        normals.write(pvs[j - 1].normal);
        uvs &&
          pvs[0].uv &&
          (uvs.write(pvs[0].uv) ||
            uvs.write(pvs[j - 2].uv) ||
            uvs.write(pvs[j - 1].uv));
        colors &&
          (colors.write(pvs[0].color) ||
            colors.write(pvs[j - 2].color) ||
            colors.write(pvs[j - 1].color));
      }
    });

    geom.setAttribute('position', new THREE.BufferAttribute(vertices.array, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(normals.array, 3));
    uvs && geom.setAttribute('uv', new THREE.BufferAttribute(uvs.array, 2));
    colors && geom.setAttribute('color', new THREE.BufferAttribute(colors.array, 3));

    if (Object.keys(grps).length) {
      let index = [];
      let gbase = 0;
      for (let gi = 0; gi < Object.keys(grps).length; gi++) {
        const key = Number(Object.keys(grps)[gi]);
        geom.addGroup(gbase, grps[key].length, gi);
        gbase += grps[key].length;
        index = index.concat(grps[key]);
      }
      geom.setIndex(index);
    }

    return geom;
  }

  static toMesh(csg, toMatrix, toMaterial) {
    const geom = CSG.toGeometry(csg);
    const inv = new THREE.Matrix4().copy(toMatrix).invert();
    geom.applyMatrix4(inv);
    geom.computeBoundingSphere();
    geom.computeBoundingBox();
    const m = new THREE.Mesh(geom, toMaterial);
    m.matrix.copy(toMatrix);
    m.matrix.decompose(m.position, m.quaternion, m.scale);
    m.rotation.setFromQuaternion(m.quaternion);
    m.updateMatrixWorld();
    m.castShadow = m.receiveShadow = true;
    return m;
  }
}

CSG.ttvv0 = new THREE.Vector3();
CSG.tmpm3 = new THREE.Matrix3();

class Vector {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  clone() {
    return new Vector(this.x, this.y, this.z);
  }

  negate() {
    this.x *= -1;
    this.y *= -1;
    this.z *= -1;
    return this;
  }

  add(a) {
    this.x += a.x;
    this.y += a.y;
    this.z += a.z;
    return this;
  }

  sub(a) {
    this.x -= a.x;
    this.y -= a.y;
    this.z -= a.z;
    return this;
  }

  times(a) {
    this.x *= a;
    this.y *= a;
    this.z *= a;
    return this;
  }

  dividedBy(a) {
    this.x /= a;
    this.y /= a;
    this.z /= a;
    return this;
  }

  lerp(a, t) {
    return this.add(Vector.tv0.copy(a).sub(this).times(t));
  }

  unit() {
    return this.dividedBy(this.length());
  }

  length() {
    return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
  }

  normalize() {
    return this.unit();
  }

  cross(b) {
    const ax = this.x, ay = this.y, az = this.z;
    const bx = b.x, by = b.y, bz = b.z;
    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }

  dot(b) {
    return this.x * b.x + this.y * b.y + this.z * b.z;
  }
}

Vector.tv0 = new Vector();
Vector.tv1 = new Vector();

class Vertex {
  constructor(pos, normal, uv, color) {
    this.pos = new Vector().copy(pos);
    this.normal = new Vector().copy(normal);
    uv && (this.uv = new Vector().copy(uv)) && (this.uv.z = 0);
    color && (this.color = new Vector().copy(color));
  }

  clone() {
    return new Vertex(this.pos, this.normal, this.uv, this.color);
  }

  flip() {
    this.normal.negate();
  }

  interpolate(other, t) {
    return new Vertex(
      this.pos.clone().lerp(other.pos, t),
      this.normal.clone().lerp(other.normal, t),
      this.uv && other.uv && this.uv.clone().lerp(other.uv, t),
      this.color && other.color && this.color.clone().lerp(other.color, t)
    );
  }
}

class Plane {
  constructor(normal, w) {
    this.normal = normal;
    this.w = w;
  }

  clone() {
    return new Plane(this.normal.clone(), this.w);
  }

  flip() {
    this.normal.negate();
    this.w = -this.w;
  }

  splitPolygon(polygon, coplanarFront, coplanarBack, front, back) {
    const COPLANAR = 0;
    const FRONT = 1;
    const BACK = 2;
    const SPANNING = 3;

    let polygonType = 0;
    const types = [];

    for (let i = 0; i < polygon.vertices.length; i++) {
      const t = this.normal.dot(polygon.vertices[i].pos) - this.w;
      const type = t < -Plane.EPSILON ? BACK : t > Plane.EPSILON ? FRONT : COPLANAR;
      polygonType |= type;
      types.push(type);
    }

    switch (polygonType) {
      case COPLANAR:
        (this.normal.dot(polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon);
        break;
      case FRONT:
        front.push(polygon);
        break;
      case BACK:
        back.push(polygon);
        break;
      case SPANNING: {
        const f = [];
        const b = [];
        for (let i = 0; i < polygon.vertices.length; i++) {
          const j = (i + 1) % polygon.vertices.length;
          const ti = types[i];
          const tj = types[j];
          const vi = polygon.vertices[i];
          const vj = polygon.vertices[j];
          if (ti != BACK) f.push(vi);
          if (ti != FRONT) b.push(ti != BACK ? vi.clone() : vi);
          if ((ti | tj) == SPANNING) {
            const t =
              (this.w - this.normal.dot(vi.pos)) /
              this.normal.dot(Vector.tv0.copy(vj.pos).sub(vi.pos));
            const v = vi.interpolate(vj, t);
            f.push(v);
            b.push(v.clone());
          }
        }
        if (f.length >= 3) front.push(new Polygon(f, polygon.shared));
        if (b.length >= 3) back.push(new Polygon(b, polygon.shared));
        break;
      }
    }
  }
}

Plane.EPSILON = 1e-5;

Plane.fromPoints = function (a, b, c) {
  const n = Vector.tv0.copy(b).sub(a).cross(Vector.tv1.copy(c).sub(a)).normalize();
  return new Plane(n.clone(), n.dot(a));
};

class Polygon {
  constructor(vertices, shared) {
    this.vertices = vertices;
    this.shared = shared;
    this.plane = Plane.fromPoints(vertices[0].pos, vertices[1].pos, vertices[2].pos);
  }

  clone() {
    return new Polygon(
      this.vertices.map((v) => v.clone()),
      this.shared
    );
  }

  flip() {
    this.vertices.reverse().forEach((v) => v.flip());
    this.plane.flip();
  }
}

class Node {
  constructor(polygons) {
    this.polygons = [];
    if (polygons) this.build(polygons);
  }

  clone() {
    const node = new Node();
    node.plane = this.plane && this.plane.clone();
    node.front = this.front && this.front.clone();
    node.back = this.back && this.back.clone();
    node.polygons = this.polygons.map((p) => p.clone());
    return node;
  }

  invert() {
    for (let i = 0; i < this.polygons.length; i++) {
      this.polygons[i].flip();
    }
    this.plane && this.plane.flip();
    this.front && this.front.invert();
    this.back && this.back.invert();
    const temp = this.front;
    this.front = this.back;
    this.back = temp;
  }

  clipPolygons(polygons) {
    if (!this.plane) return polygons.slice();
    let front = [];
    let back = [];
    for (let i = 0; i < polygons.length; i++) {
      this.plane.splitPolygon(polygons[i], front, back, front, back);
    }
    if (this.front) front = this.front.clipPolygons(front);
    if (this.back) back = this.back.clipPolygons(back);
    else back = [];
    return front.concat(back);
  }

  clipTo(bsp) {
    this.polygons = bsp.clipPolygons(this.polygons);
    if (this.front) this.front.clipTo(bsp);
    if (this.back) this.back.clipTo(bsp);
  }

  allPolygons() {
    let polygons = this.polygons.slice();
    if (this.front) polygons = polygons.concat(this.front.allPolygons());
    if (this.back) polygons = polygons.concat(this.back.allPolygons());
    return polygons;
  }

  build(polygons) {
    if (!polygons.length) return;
    if (!this.plane) this.plane = polygons[0].plane.clone();
    const front = [];
    const back = [];
    for (let i = 0; i < polygons.length; i++) {
      this.plane.splitPolygon(polygons[i], this.polygons, this.polygons, front, back);
    }
    if (front.length) {
      if (!this.front) this.front = new Node();
      this.front.build(front);
    }
    if (back.length) {
      if (!this.back) this.back = new Node();
      this.back.build(back);
    }
  }
}

Node.fromJSON = function (json) {
  return CSG.fromPolygons(
    json.polygons.map(
      (p) =>
        new Polygon(
          p.vertices.map((v) => new Vertex(v.pos, v.normal, v.uv)),
          p.shared
        )
    )
  );
};

export { CSG, Vertex, Vector, Polygon, Plane, Node };

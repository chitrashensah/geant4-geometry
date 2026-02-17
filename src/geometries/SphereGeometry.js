/**
 * @chitrashensah/geant4-geometry
 * Copyright (c) 2025 Chitrashen Sah
 * Licensed under MIT License
 */

import * as THREE from 'three';
import { CSG } from '../CSGMesh';

/**
 * Spherical sector geometry with inner/outer radius and angular cuts.
 * Equivalent to Geant4's G4Sphere.
 * 
 * @param {number} pRMin - Inner radius in millimeters
 * @param {number} pRMax - Outer radius in millimeters
 * @param {number} pSTheta - Starting theta angle in degrees
 * @param {number} pDTheta - Delta theta angle in degrees
 * @param {number} pSPhi - Starting phi angle in degrees
 * @param {number} pDPhi - Delta phi angle in degrees
 */
class SphereGeometry extends THREE.BufferGeometry {

  constructor(pRMin, pRMax, pSTheta, pDTheta, pSPhi, pDPhi) {
    super();

    this.type = 'SphereGeometry';

    // Convert degrees to radians
    const pSTheta_rad = (pSTheta * Math.PI) / 180;
    const pDTheta_rad = (pDTheta * Math.PI) / 180;
    const pSPhi_rad = (pSPhi * Math.PI) / 180;
    const pDPhi_rad = (pDPhi * Math.PI) / 180;
    const pETheta = pSTheta_rad + pDTheta_rad;

    // Use millimeters directly (no conversion)
    const pRmin = pRMin;
    const pRmax = pRMax;

    // Create base geometries
    const sphereGeometry = new THREE.SphereGeometry(pRmax);
    const innerSphereGeometry = new THREE.SphereGeometry(pRmin);

    // Box geometry for hemisphere cuts
    const boxGeometry = new THREE.BoxGeometry(pRmax * 2, pRmax, pRmax * 2);
    boxGeometry.rotateX(Math.PI / 2);
    boxGeometry.translate(0, 0, pRmax / 2);

    // Cone geometries for theta cuts
    const cone1Geometry = new THREE.CylinderGeometry(
      pRmax * Math.tan(pSTheta_rad),
      0.00001,
      pRmax
    );
    cone1Geometry.rotateX(Math.PI / 2);
    cone1Geometry.translate(0, 0, pRmax / 2);

    const cone2Geometry = new THREE.CylinderGeometry(
      pRmax * Math.tan(pETheta),
      0.0001,
      pRmax
    );
    cone2Geometry.rotateX(Math.PI / 2);
    cone2Geometry.translate(0, 0, pRmax / 2);

    const cone3Geometry = new THREE.CylinderGeometry(
      0.0001,
      pRmax * Math.tan(Math.PI - pSTheta_rad),
      pRmax
    );
    cone3Geometry.rotateX(Math.PI / 2);
    cone3Geometry.translate(0, 0, -pRmax / 2);

    const cone4Geometry = new THREE.CylinderGeometry(
      0.0001,
      pRmax * Math.tan(Math.PI - pETheta),
      pRmax
    );
    cone4Geometry.rotateX(Math.PI / 2);
    cone4Geometry.translate(0, 0, -pRmax / 2);

    // Pie shape for phi cuts
    const pieShape = new THREE.Shape();
    pieShape.absarc(0, 0, pRmax, pSPhi_rad, pSPhi_rad + pDPhi_rad, false);
    pieShape.lineTo(0, 0);
    const extrusionSettings = { depth: 2 * pRmax, bevelEnabled: false };
    const pieGeometry = new THREE.ExtrudeGeometry(pieShape, extrusionSettings);
    pieGeometry.translate(0, 0, -pRmax);

    // Convert to CSG objects
    const sphereCSG = CSG.fromGeometry(sphereGeometry);
    const innerSphereCSG = CSG.fromGeometry(innerSphereGeometry);
    const cone1CSG = CSG.fromGeometry(cone1Geometry);
    const cone2CSG = CSG.fromGeometry(cone2Geometry);
    const cone3CSG = CSG.fromGeometry(cone3Geometry);
    const cone4CSG = CSG.fromGeometry(cone4Geometry);
    const boxCSG = CSG.fromGeometry(boxGeometry);
    const pieCSG = CSG.fromGeometry(pieGeometry);

    let resultCSG = sphereCSG;

    // Apply theta cuts based on angles
    if (pSTheta_rad === 0 && pETheta > 0 && pETheta < Math.PI / 2) {
      resultCSG = cone2CSG.intersect(sphereCSG);
    } else if (pSTheta_rad === 0 && pETheta === Math.PI / 2) {
      resultCSG = boxCSG.intersect(sphereCSG);
    } else if (pSTheta_rad === 0 && pETheta > Math.PI / 2 && pETheta < Math.PI) {
      resultCSG = sphereCSG.subtract(cone4CSG);
    } else if (pSTheta_rad > 0 && pSTheta_rad < Math.PI / 2 && pETheta > pSTheta_rad && pETheta < Math.PI / 2) {
      const step1CSG = cone2CSG.subtract(cone1CSG);
      resultCSG = step1CSG.intersect(sphereCSG);
    } else if (pSTheta_rad > 0 && pSTheta_rad < Math.PI / 2 && pETheta === Math.PI / 2) {
      const step1CSG = boxCSG.subtract(cone1CSG);
      resultCSG = step1CSG.intersect(sphereCSG);
    } else if (pSTheta_rad > 0 && pSTheta_rad < Math.PI / 2 && pETheta > Math.PI / 2 && pETheta < Math.PI) {
      const step1CSG = sphereCSG.subtract(cone1CSG);
      resultCSG = step1CSG.subtract(cone4CSG);
    } else if (pSTheta_rad > 0 && pSTheta_rad < Math.PI / 2 && pETheta === Math.PI) {
      resultCSG = sphereCSG.subtract(cone1CSG);
    } else if (pSTheta_rad === Math.PI / 2 && pETheta > Math.PI / 2 && pETheta < Math.PI) {
      const step1CSG = sphereCSG.subtract(boxCSG);
      resultCSG = step1CSG.subtract(cone4CSG);
    } else if (pSTheta_rad === Math.PI / 2 && pETheta === Math.PI) {
      resultCSG = sphereCSG.subtract(boxCSG);
    } else if (pSTheta_rad > Math.PI / 2 && pSTheta_rad < Math.PI && pETheta > pSTheta_rad && pETheta < Math.PI) {
      const step1CSG = cone3CSG.subtract(cone4CSG);
      resultCSG = step1CSG.intersect(sphereCSG);
    } else if (pSTheta_rad > Math.PI / 2 && pSTheta_rad < Math.PI && pETheta === Math.PI) {
      resultCSG = sphereCSG.intersect(cone3CSG);
    }

    // Apply phi cut
    if (pDPhi_rad < Math.PI * 2) {
      resultCSG = resultCSG.intersect(pieCSG);
    }

    // Apply inner sphere subtraction
    if (pRmin > 0) {
      resultCSG = resultCSG.subtract(innerSphereCSG);
    }

    // Convert back to geometry
    const finalGeometry = CSG.toGeometry(resultCSG);
    finalGeometry.type = 'SphereGeometry';
    finalGeometry.parameters = {
      pRMin,
      pRMax,
      pSTheta,
      pDTheta,
      pSPhi,
      pDPhi,
    };

    Object.assign(this, finalGeometry);
  }

  copy(source) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }

  static fromJSON(data) {
    return new SphereGeometry(
      data.pRMin,
      data.pRMax,
      data.pSTheta,
      data.pDTheta,
      data.pSPhi,
      data.pDPhi
    );
  }
}

export { SphereGeometry };

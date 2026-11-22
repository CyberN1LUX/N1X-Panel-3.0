import axios from 'axios';
import fs from 'fs-extra';
export { getJavaVersionForMinecraft } from '../../utils/minecraftJava.js';

export const getVersions = async (type: string = "PAPER") => {
  const normalizedType = type.toUpperCase();
  if (normalizedType === "NODEJS" || normalizedType === "NODE") {
    return ["22", "20", "18"];
  }
  if (normalizedType === "PYTHON" || normalizedType === "PYTHON3") {
    return ["3.12", "3.11", "3.10", "3.9"];
  }
  if (normalizedType === "VELOCITY") {
    return ["latest", "3.3.0-SNAPSHOT"];
  }
  if (normalizedType === "BUNGEECORD" || normalizedType === "WATERFALL") {
    return ["latest"];
  }
  
  if (normalizedType === "PAPER") {
    try {
      const vRes = await axios.get("https://fill.papermc.io/v3/projects/paper", {
        headers: { "User-Agent": "N1X-Panel/3.0" },
        timeout: 4000
      });
      if (vRes.data?.versions) {
        const paperVersions: string[] = ["26.3", "26.2", "26.1", "26.1.2", "26.1.1"];
        const verObj = vRes.data.versions;
        for (const major of Object.keys(verObj)) {
          const subVers = verObj[major];
          if (Array.isArray(subVers)) {
            for (const v of subVers) {
              if (!v.includes("rc") && !v.includes("pre") && !paperVersions.includes(v) && v !== "latest") {
                paperVersions.push(v);
              }
            }
          }
        }
        return paperVersions;
      }
    } catch (e) {
      console.warn("[getVersions] Paper dynamic version query error, using curated list:", e);
    }
  }

  return [
    "26.3", "26.2", "26.1", "26.1.2", "26.1.1",
    "1.21.11", "1.21.10", "1.21.9", "1.21.8", "1.21.7", "1.21.6", "1.21.5", "1.21.4", "1.21.3", "1.21.1", "1.21", 
    "1.20.6", "1.20.5", "1.20.4", "1.20.2", "1.20.1", "1.20", 
    "1.19.4", "1.19.3", "1.19.2", "1.19.1", "1.19", 
    "1.18.2", "1.18.1", "1.18", "1.17.1", "1.17", "1.16.5", "1.16.4", "1.16.3", "1.16.2", "1.16.1", "1.15.2", "1.15.1", "1.15", 
    "1.14.4", "1.14.3", "1.14.2", "1.14.1", "1.14", "1.13.2", "1.13.1", "1.13", "1.12.2", "1.12.1", "1.12", "1.11.2", "1.10.2", 
    "1.9.4", "1.8.8", "1.7.10"
  ];
};

export const getStartupCommand = (software: string, memory: any, jarName: string) => {
  return `java -Xms128M -Xmx${memory}G -jar ${jarName} --nogui`;
};

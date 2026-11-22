export interface ParsedRam {
  mb: number;
  jvmArg: string;
  display: string;
}

/**
 * Parses user input RAM (e.g. "256 Mb", "256MB", "512 MB", "1 GB", "2G", "256", 256, 1)
 * into a structured object with MB amount, Java JVM argument (-Xmx), and human-friendly display.
 */
export function parseRam(val: any): ParsedRam {
  if (val === undefined || val === null || val === "") {
    return { mb: 1024, jvmArg: "1024M", display: "1 GB" };
  }

  const str = String(val).trim();
  const upper = str.toUpperCase();
  const num = parseFloat(str.replace(/[^0-9.]/g, ""));

  if (isNaN(num) || num <= 0) {
    return { mb: 1024, jvmArg: "1024M", display: "1 GB" };
  }

  // Explicit MB unit (e.g. "256 MB", "256Mb", "256M")
  if (upper.includes("M")) {
    const mb = Math.round(num);
    return {
      mb,
      jvmArg: `${mb}M`,
      display: `${mb} MB`
    };
  }

  // Explicit GB unit (e.g. "1 GB", "2G", "0.5 GB")
  if (upper.includes("G")) {
    const mb = Math.round(num * 1024);
    const displayNum = Number.isInteger(num) ? num : parseFloat(num.toFixed(2));
    return {
      mb,
      jvmArg: `${mb}M`,
      display: `${displayNum} GB`
    };
  }

  // Bare number without unit:
  // Numbers >= 64 (e.g. 128, 256, 512, 1024) are treated as MB
  // Numbers < 64 (e.g. 0.25, 0.5, 1, 2, 4, 8, 16, 32) are treated as GB
  if (num >= 64) {
    const mb = Math.round(num);
    return {
      mb,
      jvmArg: `${mb}M`,
      display: `${mb} MB`
    };
  } else {
    const mb = Math.round(num * 1024);
    const displayNum = Number.isInteger(num) ? num : parseFloat(num.toFixed(2));
    return {
      mb,
      jvmArg: `${mb}M`,
      display: `${displayNum} GB`
    };
  }
}

export function formatRam(val: any): string {
  return parseRam(val).display;
}

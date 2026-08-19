import Image from "next/image";

export function Brand({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  if (compact) return <Image className="brand-mark" src="/yorento-mark.svg" alt="yoRento" width={34} height={34} priority />;
  if (light) return <Image className="brand-wordmark" src="/yorento-wordmark-light.svg" alt="yoRento" width={154} height={36} priority />;
  return <span className="brand-theme-pair"><Image className="brand-wordmark brand-logo-dark" src="/yorento-wordmark.svg" alt="yoRento" width={154} height={36} priority /><Image className="brand-wordmark brand-logo-light" src="/yorento-wordmark-light.svg" alt="yoRento" width={154} height={36} priority /></span>;
}

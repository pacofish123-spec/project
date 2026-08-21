import type { LucideIcon } from "lucide-react";
import { Baby, Bluetooth, Camera, Flame, Gauge, KeyRound, Navigation, PackageOpen, Smartphone, Sun, Usb, Video } from "lucide-react";
import type { TranslationKey } from "@/lib/translations";

// Shared between the "list your car" form (what a host can flag) and
// the vehicle detail page (what a renter sees, as a small icon strip)
// — one source of truth for the value stored in vehicles.amenities
// and its label/icon.
export const vehicleAmenities: Array<{ value: string; labelKey: TranslationKey; icon: LucideIcon }> = [
  { value: "bluetooth", labelKey: "amenityBluetooth", icon: Bluetooth },
  { value: "backup_camera", labelKey: "amenityBackupCamera", icon: Camera },
  { value: "usb_charging", labelKey: "amenityUsbCharging", icon: Usb },
  { value: "child_seat", labelKey: "amenityChildSeat", icon: Baby },
  { value: "gps", labelKey: "amenityGps", icon: Navigation },
  { value: "sunroof", labelKey: "amenitySunroof", icon: Sun },
  { value: "heated_seats", labelKey: "amenityHeatedSeats", icon: Flame },
  { value: "cruise_control", labelKey: "amenityCruiseControl", icon: Gauge },
  { value: "keyless_entry", labelKey: "amenityKeylessEntry", icon: KeyRound },
  { value: "carplay", labelKey: "amenityCarplay", icon: Smartphone },
  { value: "roof_rack", labelKey: "amenityRoofRack", icon: PackageOpen },
  { value: "dash_cam", labelKey: "amenityDashCam", icon: Video },
];

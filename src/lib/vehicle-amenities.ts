import type { TranslationKey } from "@/lib/translations";

// Shared between the "list your car" form (what a host can flag) and
// the vehicle detail page (what a renter sees) — one source of truth
// for the value stored in vehicles.amenities and its label.
export const vehicleAmenities: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: "bluetooth", labelKey: "amenityBluetooth" },
  { value: "backup_camera", labelKey: "amenityBackupCamera" },
  { value: "usb_charging", labelKey: "amenityUsbCharging" },
  { value: "child_seat", labelKey: "amenityChildSeat" },
  { value: "gps", labelKey: "amenityGps" },
  { value: "sunroof", labelKey: "amenitySunroof" },
  { value: "heated_seats", labelKey: "amenityHeatedSeats" },
  { value: "cruise_control", labelKey: "amenityCruiseControl" },
  { value: "keyless_entry", labelKey: "amenityKeylessEntry" },
  { value: "carplay", labelKey: "amenityCarplay" },
  { value: "roof_rack", labelKey: "amenityRoofRack" },
  { value: "dash_cam", labelKey: "amenityDashCam" },
];

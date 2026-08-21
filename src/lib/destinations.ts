export interface Destination {
  name: string;
  photo: string;
}

// 31 Dominican Republic cities/towns — one curated, verified photo each,
// reused everywhere a destination needs a picture: the /search banner,
// the homepage's featured few, and the full "explore destinations" list.
export const drDestinations: Destination[] = [
  { name: "Santo Domingo", photo: "https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?auto=format&fit=crop&w=1600&q=80" },
  { name: "Punta Cana", photo: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80" },
  { name: "Bávaro", photo: "https://images.unsplash.com/photo-1505738093940-b187b0e6d6d9?auto=format&fit=crop&w=1600&q=80" },
  { name: "Samaná", photo: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1600&q=80" },
  { name: "Las Terrenas", photo: "https://images.unsplash.com/photo-1693761935586-5939ab418d0d?auto=format&fit=crop&w=1600&q=80" },
  { name: "Puerto Plata", photo: "https://images.unsplash.com/photo-1780777424838-3ec34be67737?auto=format&fit=crop&w=1600&q=80" },
  { name: "Santiago", photo: "https://images.unsplash.com/photo-1558353093-5d0c837b61e7?auto=format&fit=crop&w=1600&q=80" },
  { name: "La Romana", photo: "https://images.unsplash.com/photo-1684980461524-6eed0f9e30b7?auto=format&fit=crop&w=1600&q=80" },
  { name: "Boca Chica", photo: "https://images.unsplash.com/photo-1597780377773-e56fe765a903?auto=format&fit=crop&w=1600&q=80" },
  { name: "Jarabacoa", photo: "https://images.unsplash.com/photo-1650593963138-1d2e64afd70b?auto=format&fit=crop&w=1600&q=80" },
  { name: "Sosúa", photo: "https://images.unsplash.com/photo-1592455639374-b7ad0189dfbb?auto=format&fit=crop&w=1600&q=80" },
  { name: "Cabarete", photo: "https://images.unsplash.com/photo-1662524613691-4a6ad55577db?auto=format&fit=crop&w=1600&q=80" },
  { name: "Barahona", photo: "https://images.unsplash.com/photo-1683336474667-420dabe065b5?auto=format&fit=crop&w=1600&q=80" },
  { name: "Higüey", photo: "https://images.unsplash.com/photo-1667871124729-54ba82b9fb23?auto=format&fit=crop&w=1600&q=80" },
  { name: "La Vega", photo: "https://images.unsplash.com/photo-1585571742031-e2897e2ff614?auto=format&fit=crop&w=1600&q=80" },
  { name: "San Cristóbal", photo: "https://images.unsplash.com/photo-1621625287453-3f3ffde85dde?auto=format&fit=crop&w=1600&q=80" },
  { name: "Monte Cristi", photo: "https://images.unsplash.com/photo-1720802622465-64008a368fa8?auto=format&fit=crop&w=1600&q=80" },
  { name: "Pedernales", photo: "https://images.unsplash.com/photo-1597326156501-baac0c5f395b?auto=format&fit=crop&w=1600&q=80" },
  { name: "San Pedro de Macorís", photo: "https://images.unsplash.com/photo-1612385822428-324aea55ee13?auto=format&fit=crop&w=1600&q=80" },
  { name: "Moca", photo: "https://images.unsplash.com/photo-1773004770638-a8dbfc40ceee?auto=format&fit=crop&w=1600&q=80" },
  { name: "Azua", photo: "https://images.unsplash.com/photo-1786640008540-f59f2e06e6ca?auto=format&fit=crop&w=1600&q=80" },
  { name: "Baní", photo: "https://images.unsplash.com/photo-1686521157266-e8ca50efdd63?auto=format&fit=crop&w=1600&q=80" },
  { name: "Bonao", photo: "https://images.unsplash.com/photo-1585573098393-e11fc82c11af?auto=format&fit=crop&w=1600&q=80" },
  { name: "Nagua", photo: "https://images.unsplash.com/photo-1708139374568-55ef92a2486d?auto=format&fit=crop&w=1600&q=80" },
  { name: "Constanza", photo: "https://images.unsplash.com/photo-1723745999496-4b3b936b8cc5?auto=format&fit=crop&w=1600&q=80" },
  { name: "Hato Mayor", photo: "https://images.unsplash.com/photo-1720803370801-04e268f7db31?auto=format&fit=crop&w=1600&q=80" },
  { name: "Dajabón", photo: "https://images.unsplash.com/photo-1670689708155-6841be26db33?auto=format&fit=crop&w=1600&q=80" },
  { name: "El Seibo", photo: "https://images.unsplash.com/photo-1590722633747-8f0a8dd82be6?auto=format&fit=crop&w=1600&q=80" },
  { name: "San Juan de la Maguana", photo: "https://images.unsplash.com/photo-1599594555336-521adee40078?auto=format&fit=crop&w=1600&q=80" },
  { name: "Monte Plata", photo: "https://images.unsplash.com/photo-1711823901105-748c9a1861c3?auto=format&fit=crop&w=1600&q=80" },
  { name: "San Francisco de Macorís", photo: "https://images.unsplash.com/photo-1692895036454-d3c37c499349?auto=format&fit=crop&w=1600&q=80" },
];

export function findDestinationPhoto(location: string | null | undefined): string {
  const fallback = drDestinations[0].photo;
  if (!location) return fallback;
  const match = drDestinations.find((destination) => destination.name.toLowerCase() === location.trim().toLowerCase());
  return match?.photo ?? fallback;
}

// URL-safe slug for per-destination pages/OG metadata — strips accents
// (Bávaro -> bavaro, San Cristóbal -> san-cristobal) so links stay ASCII.
export function slugifyDestination(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function findDestinationBySlug(slug: string): Destination | undefined {
  return drDestinations.find((destination) => slugifyDestination(destination.name) === slug);
}

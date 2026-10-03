import { distinctPublishers } from "./publisher";
import type { NewsCandidate } from "@/lib/domain/models";
import type { Impact, Region } from "@/lib/domain/types";
import { likelySameStory } from "@/lib/domain/news-intelligence";
import { regionFromCountry, suggestedCategory } from "@/lib/domain/regions";

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const places: { label: string; country: string; lat: number; lng: number; names?: string[] }[] = [
  { label: "São Paulo", country: "Brazil", lat: -23.5505, lng: -46.6333 },
  { label: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lng: -43.1729 },
  { label: "Brasília", country: "Brazil", lat: -15.7939, lng: -47.8828 },
  { label: "Porto Alegre", country: "Brazil", lat: -30.0346, lng: -51.2177 },
  { label: "Belo Horizonte", country: "Brazil", lat: -19.9167, lng: -43.9345 },
  { label: "Recife", country: "Brazil", lat: -8.0476, lng: -34.877 },
  { label: "Salvador", country: "Brazil", lat: -12.9777, lng: -38.5016 },
  { label: "Manaus", country: "Brazil", lat: -3.119, lng: -60.0217 },
  { label: "Curitiba", country: "Brazil", lat: -25.4284, lng: -49.2733 },
  { label: "Buenos Aires", country: "Argentina", lat: -34.6037, lng: -58.3816 },
  {
    label: "Cidade do México",
    country: "Mexico",
    lat: 19.4326,
    lng: -99.1332,
    names: ["Ciudad de Mexico", "Mexico City", "CDMX"],
  },
  { label: "Bogotá", country: "Colombia", lat: 4.711, lng: -74.0721 },
  {
    label: "Santiago do Chile",
    country: "Chile",
    lat: -33.4489,
    lng: -70.6693,
    names: ["Santiago de Chile"],
  },
  { label: "Lima", country: "Peru", lat: -12.0464, lng: -77.0428 },
  { label: "Quito", country: "Ecuador", lat: -0.1807, lng: -78.4678 },
  { label: "Caracas", country: "Venezuela", lat: 10.4806, lng: -66.9036 },
  { label: "Montevidéu", country: "Uruguay", lat: -34.9011, lng: -56.1645, names: ["Montevideo"] },
  { label: "Assunção", country: "Paraguay", lat: -25.2637, lng: -57.5759, names: ["Asuncion"] },
  { label: "La Paz", country: "Bolivia", lat: -16.4897, lng: -68.1193 },
  { label: "San José", country: "Costa Rica", lat: 9.9281, lng: -84.0907 },
  { label: "Havana", country: "Cuba", lat: 23.1136, lng: -82.3666, names: ["La Habana", "Havana"] },
  { label: "Miami", country: "United States", lat: 25.7617, lng: -80.1918 },
  { label: "Nova York", country: "United States", lat: 40.7128, lng: -74.006, names: ["New York"] },
  { label: "Los Angeles", country: "United States", lat: 34.0522, lng: -118.2437 },
  { label: "Lisboa", country: "Portugal", lat: 38.7223, lng: -9.1393, names: ["Lisbon"] },
  { label: "Madri", country: "Spain", lat: 40.4168, lng: -3.7038, names: ["Madrid"] },
  { label: "Paris", country: "France", lat: 48.8566, lng: 2.3522 },
  { label: "Londres", country: "United Kingdom", lat: 51.5072, lng: -0.1276, names: ["London"] },
  { label: "Tóquio", country: "Japan", lat: 35.6762, lng: 139.6503, names: ["Tokyo"] },
];
// Country-only headlines use a capital as a reference point, never as the claimed event site.
const capitals: Record<string, { label: string; lat: number; lng: number }> = {
  Brazil: { label: "Brasília", lat: -15.7939, lng: -47.8828 },
  Argentina: { label: "Buenos Aires", lat: -34.6037, lng: -58.3816 },
  Mexico: { label: "Cidade do México", lat: 19.4326, lng: -99.1332 },
  Colombia: { label: "Bogotá", lat: 4.711, lng: -74.0721 },
  Chile: { label: "Santiago", lat: -33.4489, lng: -70.6693 },
  Peru: { label: "Lima", lat: -12.0464, lng: -77.0428 },
  Bolivia: { label: "Sucre", lat: -19.0196, lng: -65.2619 },
  Uruguay: { label: "Montevidéu", lat: -34.9011, lng: -56.1645 },
  Paraguay: { label: "Assunção", lat: -25.2637, lng: -57.5759 },
  Ecuador: { label: "Quito", lat: -0.1807, lng: -78.4678 },
  Venezuela: { label: "Caracas", lat: 10.4806, lng: -66.9036 },
  "Costa Rica": { label: "San José", lat: 9.9281, lng: -84.0907 },
  Cuba: { label: "Havana", lat: 23.1136, lng: -82.3666 },
  Panama: { label: "Cidade do Panamá", lat: 8.9824, lng: -79.5199 },
  Guatemala: { label: "Cidade da Guatemala", lat: 14.6349, lng: -90.5069 },
  Honduras: { label: "Tegucigalpa", lat: 14.0723, lng: -87.1921 },
  Nicaragua: { label: "Manágua", lat: 12.1149, lng: -86.2362 },
  "El Salvador": { label: "San Salvador", lat: 13.6929, lng: -89.2182 },
  "Dominican Republic": { label: "Santo Domingo", lat: 18.4861, lng: -69.9312 },
  Haiti: { label: "Porto Príncipe", lat: 18.5944, lng: -72.3074 },
  "United States": { label: "Washington", lat: 38.9072, lng: -77.0369 },
  Canada: { label: "Ottawa", lat: 45.4215, lng: -75.6972 },
  "United Kingdom": { label: "Londres", lat: 51.5072, lng: -0.1276 },
  Spain: { label: "Madri", lat: 40.4168, lng: -3.7038 },
  Portugal: { label: "Lisboa", lat: 38.7223, lng: -9.1393 },
  France: { label: "Paris", lat: 48.8566, lng: 2.3522 },
  Germany: { label: "Berlim", lat: 52.52, lng: 13.405 },
  Italy: { label: "Roma", lat: 41.9028, lng: 12.4964 },
  China: { label: "Pequim", lat: 39.9042, lng: 116.4074 },
  Japan: { label: "Tóquio", lat: 35.6762, lng: 139.6503 },
  India: { label: "Nova Délhi", lat: 28.6139, lng: 77.209 },
  Indonesia: { label: "Jacarta", lat: -6.2088, lng: 106.8456 },
  Australia: { label: "Camberra", lat: -35.2809, lng: 149.13 },
  "New Zealand": { label: "Wellington", lat: -41.2866, lng: 174.7756 },
  Nigeria: { label: "Abuja", lat: 9.0765, lng: 7.3986 },
  Egypt: { label: "Cairo", lat: 30.0444, lng: 31.2357 },
  Turkey: { label: "Ancara", lat: 39.9334, lng: 32.8597 },
  Russia: { label: "Moscou", lat: 55.7558, lng: 37.6173 },
  Ukraine: { label: "Kyiv", lat: 50.4501, lng: 30.5234 },
  Pakistan: { label: "Islamabade", lat: 33.6844, lng: 73.0479 },
  Bangladesh: { label: "Daca", lat: 23.8103, lng: 90.4125 },
  "South Korea": { label: "Seul", lat: 37.5665, lng: 126.978 },
  "Saudi Arabia": { label: "Riade", lat: 24.7136, lng: 46.6753 },
  "United Arab Emirates": { label: "Abu Dhabi", lat: 24.4539, lng: 54.3773 },
};
const countryNames: { label: string; country: string; names: string[] }[] = [
  { label: "Brasil", country: "Brazil", names: ["brasil", "brazil", "rio grande do sul", "rs"] },
  { label: "Argentina", country: "Argentina", names: ["argentina"] },
  { label: "México", country: "Mexico", names: ["mexico"] },
  { label: "Colômbia", country: "Colombia", names: ["colombia"] },
  { label: "Chile", country: "Chile", names: ["chile"] },
  { label: "Peru", country: "Peru", names: ["peru"] },
  { label: "Bolívia", country: "Bolivia", names: ["bolivia"] },
  { label: "Uruguai", country: "Uruguay", names: ["uruguai", "uruguay"] },
  { label: "Paraguai", country: "Paraguay", names: ["paraguai", "paraguay"] },
  { label: "Equador", country: "Ecuador", names: ["equador", "ecuador"] },
  { label: "Venezuela", country: "Venezuela", names: ["venezuela"] },
  {
    label: "Estados Unidos",
    country: "United States",
    names: ["estados unidos", "united states", "eua", "u.s."],
  },
  { label: "Espanha", country: "Spain", names: ["espanha", "spain"] },
  { label: "Portugal", country: "Portugal", names: ["portugal"] },
  { label: "França", country: "France", names: ["franca", "france"] },
  { label: "China", country: "China", names: ["china"] },
  { label: "Japão", country: "Japan", names: ["japao", "japan"] },
  {
    label: "Reino Unido",
    country: "United Kingdom",
    names: ["reino unido", "united kingdom", "britain"],
  },
  { label: "Canadá", country: "Canada", names: ["canada"] },
  { label: "Alemanha", country: "Germany", names: ["alemanha", "germany", "deutschland"] },
  { label: "Itália", country: "Italy", names: ["italia", "italy"] },
  { label: "Índia", country: "India", names: ["india"] },
  { label: "Indonésia", country: "Indonesia", names: ["indonesia"] },
  { label: "Austrália", country: "Australia", names: ["australia"] },
  { label: "Nova Zelândia", country: "New Zealand", names: ["nova zelandia", "new zealand"] },
  { label: "Panamá", country: "Panama", names: ["panama"] },
  { label: "Guatemala", country: "Guatemala", names: ["guatemala"] },
  { label: "Honduras", country: "Honduras", names: ["honduras"] },
  { label: "Nicarágua", country: "Nicaragua", names: ["nicaragua"] },
  { label: "El Salvador", country: "El Salvador", names: ["el salvador"] },
  {
    label: "República Dominicana",
    country: "Dominican Republic",
    names: ["republica dominicana", "dominican republic"],
  },
  { label: "Haiti", country: "Haiti", names: ["haiti"] },
  { label: "Costa Rica", country: "Costa Rica", names: ["costa rica"] },
  { label: "Cuba", country: "Cuba", names: ["cuba"] },
  { label: "Nigéria", country: "Nigeria", names: ["nigeria"] },
  { label: "Egito", country: "Egypt", names: ["egito", "egypt"] },
  { label: "Turquia", country: "Turkey", names: ["turquia", "turkey", "turkiye"] },
  { label: "Rússia", country: "Russia", names: ["russia"] },
  { label: "Ucrânia", country: "Ukraine", names: ["ucrania", "ukraine"] },
  { label: "Paquistão", country: "Pakistan", names: ["paquistao", "pakistan"] },
  { label: "Bangladesh", country: "Bangladesh", names: ["bangladesh"] },
  { label: "Coreia do Sul", country: "South Korea", names: ["coreia do sul", "south korea"] },
  { label: "Arábia Saudita", country: "Saudi Arabia", names: ["arabia saudita", "saudi arabia"] },
  {
    label: "Emirados Árabes Unidos",
    country: "United Arab Emirates",
    names: ["emirados arabes unidos", "united arab emirates", "uae"],
  },
];
function contains(text: string, name: string) {
  const escaped = normalize(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z])${escaped}(?:$|[^a-z])`, "i").test(text);
}

export function suggestNews(item: NewsCandidate, all: NewsCandidate[]) {
  const title = normalize(item.title);
  const cities = places.filter((place) =>
    [place.label, ...(place.names ?? [])].some((name) => contains(title, name)),
  );
  const city = cities.length === 1 ? cities[0] : null;
  const countries = countryNames.filter((place) =>
    place.names.some((name) => contains(title, name)),
  );
  const country = countries.length === 1 ? countries[0] : null;
  const locationAmbiguous =
    cities.length > 1 ||
    countries.length > 1 ||
    Boolean(city && country && city.country !== country.country);
  const conflictingPlaces = locationAmbiguous;
  const compatibleCity = conflictingPlaces ? null : city;
  const identifiedCountry = conflictingPlaces
    ? null
    : (compatibleCity?.country ?? country?.country ?? null);
  const capital = identifiedCountry ? capitals[identifiedCountry] : null;
  const region = identifiedCountry ? regionFromCountry(identifiedCountry) : null;
  const corroboration = all.find(
    (other) =>
      distinctPublishers(other.url, item.url) &&
      likelySameStory(item, other) &&
      other.url.startsWith("https://"),
  );
  const impact: Impact = /\b(catastroph|catastrof|mass fatalit|devastat|colapso|collapse)\b/i.test(
    title,
  )
    ? "critical"
    : /\b(tornado|hurricane|huracan|furacao|tsunami|earthquake|terremoto|fatal|mort|dead|killed|evacua|explos)\b/i.test(
          title,
        )
      ? "high"
      : "moderate";
  const excerpt = item.description?.replace(/\s+/g, " ").trim();
  const summary =
    excerpt && excerpt.length >= 35
      ? excerpt.slice(0, 500)
      : `A publicação de ${item.domain} relata: ${item.title}.`;
  return {
    category: item.category ?? suggestedCategory(item.title),
    impact: item.impact ?? impact,
    region: item.region ?? (region as Region | null) ?? "",
    location:
      item.location ??
      (compatibleCity
        ? `${compatibleCity.label}, ${compatibleCity.country}`
        : country && capital
          ? `${country.label} · referência: ${capital.label}`
          : conflictingPlaces
            ? ""
            : (country?.label ?? "")),
    lat:
      item.lat === undefined
        ? compatibleCity
          ? String(compatibleCity.lat)
          : capital
            ? String(capital.lat)
            : ""
        : String(item.lat),
    lng:
      item.lng === undefined
        ? compatibleCity
          ? String(compatibleCity.lng)
          : capital
            ? String(capital.lng)
            : ""
        : String(item.lng),
    country: identifiedCountry ?? "",
    geoPrecision: compatibleCity ? ("point" as const) : capital ? ("country" as const) : null,
    locationAmbiguous,
    summary: item.summary ?? summary,
    verificationUrl: item.verificationUrl ?? corroboration?.url ?? "",
    verifiedLevel: item.verifiedLevel == null ? "" : String(item.verifiedLevel),
    locationSuggested: !item.location && Boolean(compatibleCity || country),
    coordinatesSuggested: item.lat === undefined && Boolean(compatibleCity || capital),
    corroborationSuggested: !item.verificationUrl && Boolean(corroboration),
  };
}

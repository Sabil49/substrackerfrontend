// Popular subscription services offered in "Add Subscription". `domain` is used
// to fetch the service's real logo (see components/ServiceIcon.tsx); `price` is
// only a starting suggestion the user can edit. Kept alphabetical so the
// quick-add list is always in A–Z order.
export interface PopularService {
  name: string;
  domain: string;
  category: string; // one of Categories[].id
  price: number;
  billingCycle: "weekly" | "monthly" | "yearly";
  color: string;
}

const SERVICES: PopularService[] = [
  { name: "Adobe Creative Cloud", domain: "adobe.com", category: "work", price: 59.99, billingCycle: "monthly", color: "#FA0F00" },
  { name: "Amazon Prime", domain: "amazon.com", category: "shopping", price: 14.99, billingCycle: "monthly", color: "#00A8E1" },
  { name: "Apple Music", domain: "music.apple.com", category: "entertainment", price: 10.99, billingCycle: "monthly", color: "#FA243C" },
  { name: "Apple TV+", domain: "tv.apple.com", category: "entertainment", price: 9.99, billingCycle: "monthly", color: "#111111" },
  { name: "Audible", domain: "audible.com", category: "entertainment", price: 14.95, billingCycle: "monthly", color: "#F8991C" },
  { name: "ChatGPT Plus", domain: "chatgpt.com", category: "work", price: 20, billingCycle: "monthly", color: "#10A37F" },
  { name: "Claude Pro", domain: "claude.ai", category: "work", price: 20, billingCycle: "monthly", color: "#D97757" },
  { name: "Canva Pro", domain: "canva.com", category: "work", price: 15, billingCycle: "monthly", color: "#00C4CC" },
  { name: "Crunchyroll", domain: "crunchyroll.com", category: "entertainment", price: 7.99, billingCycle: "monthly", color: "#F47521" },
  { name: "Discord Nitro", domain: "discord.com", category: "entertainment", price: 9.99, billingCycle: "monthly", color: "#5865F2" },
  { name: "Disney+", domain: "disneyplus.com", category: "entertainment", price: 13.99, billingCycle: "monthly", color: "#113CCF" },
  { name: "Dropbox", domain: "dropbox.com", category: "storage", price: 11.99, billingCycle: "monthly", color: "#0061FF" },
  { name: "DuoLingo Super", domain: "duolingo.com", category: "other", price: 12.99, billingCycle: "monthly", color: "#58CC02" },
  { name: "Evernote", domain: "evernote.com", category: "work", price: 14.99, billingCycle: "monthly", color: "#00A82D" },
  { name: "Figma", domain: "figma.com", category: "work", price: 15, billingCycle: "monthly", color: "#A259FF" },
  { name: "Google One", domain: "one.google.com", category: "storage", price: 2.99, billingCycle: "monthly", color: "#4285F4" },
  { name: "HBO Max", domain: "max.com", category: "entertainment", price: 16.99, billingCycle: "monthly", color: "#5B2BE0" },
  { name: "Headspace", domain: "headspace.com", category: "health", price: 12.99, billingCycle: "monthly", color: "#F47D31" },
  { name: "Hulu", domain: "hulu.com", category: "entertainment", price: 9.99, billingCycle: "monthly", color: "#1CE783" },
  { name: "iCloud+", domain: "icloud.com", category: "storage", price: 2.99, billingCycle: "monthly", color: "#3693F3" },
  { name: "LinkedIn Premium", domain: "linkedin.com", category: "work", price: 39.99, billingCycle: "monthly", color: "#0A66C2" },
  { name: "Microsoft 365", domain: "microsoft.com", category: "work", price: 9.99, billingCycle: "monthly", color: "#D83B01" },
  { name: "Netflix", domain: "netflix.com", category: "entertainment", price: 15.49, billingCycle: "monthly", color: "#E50914" },
  { name: "Notion", domain: "notion.so", category: "work", price: 10, billingCycle: "monthly", color: "#000000" },
  { name: "NordVPN", domain: "nordvpn.com", category: "other", price: 12.99, billingCycle: "monthly", color: "#4687FF" },
  { name: "Paramount+", domain: "paramountplus.com", category: "entertainment", price: 11.99, billingCycle: "monthly", color: "#0064FF" },
  { name: "Peacock", domain: "peacocktv.com", category: "entertainment", price: 7.99, billingCycle: "monthly", color: "#111111" },
  { name: "Peloton", domain: "onepeloton.com", category: "fitness", price: 12.99, billingCycle: "monthly", color: "#DF1C2F" },
  { name: "PlayStation Plus", domain: "playstation.com", category: "entertainment", price: 9.99, billingCycle: "monthly", color: "#003791" },
  { name: "Slack", domain: "slack.com", category: "work", price: 8.75, billingCycle: "monthly", color: "#4A154B" },
  { name: "Spotify", domain: "spotify.com", category: "entertainment", price: 11.99, billingCycle: "monthly", color: "#1DB954" },
  { name: "Strava", domain: "strava.com", category: "fitness", price: 11.99, billingCycle: "monthly", color: "#FC4C02" },
  { name: "Twitch", domain: "twitch.tv", category: "entertainment", price: 8.99, billingCycle: "monthly", color: "#9146FF" },
  { name: "Xbox Game Pass", domain: "xbox.com", category: "entertainment", price: 16.99, billingCycle: "monthly", color: "#107C10" },
  { name: "YouTube Premium", domain: "youtube.com", category: "entertainment", price: 13.99, billingCycle: "monthly", color: "#FF0000" },
  { name: "YouTube Music", domain: "music.youtube.com", category: "entertainment", price: 10.99, billingCycle: "monthly", color: "#FF0000" },
  { name: "Zoom", domain: "zoom.us", category: "work", price: 15.99, billingCycle: "monthly", color: "#0B5CFF" },
];

export const POPULAR_SERVICES: PopularService[] = SERVICES.slice().sort((a, b) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
);

// Case-insensitive "contains" match, with names that START with the text first.
export function filterServices(query: string): PopularService[] {
  const q = query.trim().toLowerCase();
  if (!q) return POPULAR_SERVICES;
  const starts: PopularService[] = [];
  const contains: PopularService[] = [];
  for (const service of POPULAR_SERVICES) {
    const name = service.name.toLowerCase();
    if (name.startsWith(q)) starts.push(service);
    else if (name.includes(q)) contains.push(service);
  }
  return [...starts, ...contains];
}

// Finds the popular service a saved subscription refers to (e.g. "Netflix" or
// "Netflix Premium"), so lists and detail screens can show its real logo.
export function findServiceByName(name?: string | null): PopularService | undefined {
  const text = (name ?? "").trim().toLowerCase();
  if (!text) return undefined;
  return (
    POPULAR_SERVICES.find((service) => service.name.toLowerCase() === text) ||
    POPULAR_SERVICES.find((service) => {
      const serviceName = service.name.toLowerCase();
      return serviceName.length >= 4 && text.includes(serviceName);
    })
  );
}

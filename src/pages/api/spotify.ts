import type { APIRoute } from "astro";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_NOW_PLAYING_URL = "https://api.spotify.com/v1/me/player/currently-playing";
const SPOTIFY_RECENT_URL = "https://api.spotify.com/v1/me/player/recently-played?limit=1";

async function getAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token as string | undefined;
}

async function fetchJson(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 204) return null;
  if (!res.ok) return null;
  return res.json();
}

export const GET: APIRoute = async () => {
  const token = await getAccessToken();
  if (!token) {
    return new Response(
      JSON.stringify({ error: "missing_spotify_env" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const [nowPlaying, recent] = await Promise.all([
    fetchJson(SPOTIFY_NOW_PLAYING_URL, token),
    fetchJson(SPOTIFY_RECENT_URL, token)
  ]);

  const nowTrack = nowPlaying?.item;
  const recentTrack = recent?.items?.[0]?.track;

  const result = {
    now: nowTrack
      ? {
          title: nowTrack.name,
          artist: nowTrack.artists?.map((a: any) => a.name).join(", ") ?? "",
          album: nowTrack.album?.name ?? ""
        }
      : null,
    last: recentTrack
      ? {
          title: recentTrack.name,
          artist: recentTrack.artists?.map((a: any) => a.name).join(", ") ?? "",
          album: recentTrack.album?.name ?? ""
        }
      : null
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=30"
    }
  });
};

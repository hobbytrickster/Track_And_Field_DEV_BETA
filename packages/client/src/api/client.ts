// In dev, Vite proxies /api to localhost:3001. In production, hit port 3001 on the same host.
const API_BASE = (import.meta as any).env?.VITE_API_URL
  || (typeof window !== 'undefined' && window.location.port === '8080'
    ? `${window.location.protocol}//${window.location.hostname}:3001/api`
    : '/api');

let authToken: string | null = localStorage.getItem('trackstars_token');

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('trackstars_token', token);
  } else {
    localStorage.removeItem('trackstars_token');
  }
}

export function getToken(): string | null {
  return authToken;
}

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Only set Content-Type for methods that send a body
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// Auth
export const api = {
  register: (username: string, password: string, displayName: string) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, displayName }) }),

  login: (username: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  getMe: () => request('/auth/me'),
  updateAppearance: (appearance: any) =>
    request('/auth/appearance', { method: 'PUT', body: JSON.stringify(appearance) }),
  updateProfile: (data: { displayName: string }) =>
    request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  updateStadium: (stadium: any) =>
    request('/auth/stadium', { method: 'PUT', body: JSON.stringify(stadium) }),

  // Collection
  getAthletes: () => request('/collection/athletes'),
  getBoosts: () => request('/collection/boosts'),
  levelUpAthlete: (id: string, sacrificeId: string) =>
    request(`/collection/athletes/${id}/levelup`, { method: 'POST', body: JSON.stringify({ sacrificeId }) }),
  updateAthleteAppearance: (id: string, appearance: any) =>
    request(`/collection/athletes/${id}/appearance`, { method: 'PUT', body: JSON.stringify(appearance) }),
  releaseAthlete: (id: string) =>
    request(`/collection/athletes/${id}`, { method: 'DELETE' }),
  getTeamCount: () => request('/collection/count'),

  // Shop
  getShop: () => request('/shop'),
  buyPack: (packType: string) =>
    request('/shop/buy-pack', { method: 'POST', body: JSON.stringify({ packType }) }),

  // Race
  startRace: (eventType: string, userAthleteId: string, boostIds: string[]) =>
    request('/race/start', { method: 'POST', body: JSON.stringify({ eventType, userAthleteId, boostIds }) }),

  getRaceHistory: () => request('/race/history'),
  getRecords: () => request('/race/records'),
  getBestTimes: (eventType: string) => request(`/race/best-times/${eventType}`),

  // Friends
  getFriendCode: () => request('/friends/code'),
  addFriend: (code: string) => request('/friends/add', { method: 'POST', body: JSON.stringify({ code }) }),
  removeFriend: (friendId: string) => request(`/friends/${friendId}`, { method: 'DELETE' }),
  getFriends: () => request('/friends'),
  getFriendHistory: (friendId: string) => request(`/friends/${friendId}/history`),

  // Challenges
  createChallenge: (friendId: string, eventType: string, userAthleteId: string, boostIds: string[], friendIds?: string[]) =>
    request('/challenge/create', { method: 'POST', body: JSON.stringify({ friendId, friendIds, eventType, userAthleteId, boostIds }) }),
  submitChallenge: (challengeId: string, userAthleteId: string, boostIds: string[]) =>
    request('/challenge/submit', { method: 'POST', body: JSON.stringify({ challengeId, userAthleteId, boostIds }) }),
  declineChallenge: (challengeId: string) =>
    request('/challenge/decline', { method: 'POST', body: JSON.stringify({ challengeId }) }),
  getPendingChallenges: () => request('/challenge/pending'),
  getChallengeList: () => request('/challenge/list'),
  getChallengeResult: (id: string) => request(`/challenge/${id}/result`),
};

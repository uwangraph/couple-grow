export class AuthState {
  token = $state<string | null>(null);
  user = $state<{ id: string; email: string; name: string; partner_id: string | null; avatar: string | null; birthday: string | null; anniversary: string | null; bio: string | null } | null>(null);
  partner = $state<{ id: string; email: string; name: string; avatar: string | null; birthday: string | null; anniversary: string | null; bio: string | null } | null>(null);

  constructor() {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      const storedPartner = localStorage.getItem('partner');
      if (storedToken) {
        this.token = storedToken;
      }
      if (storedUser) {
        try { this.user = JSON.parse(storedUser); } catch(e) {}
      }
      if (storedPartner) {
        try { this.partner = JSON.parse(storedPartner); } catch(e) {}
      }
    }
  }

  setToken(t: string) {
    this.token = t;
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', t);
    }
  }

  setUser(u: any, p: any = null) {
    this.user = u;
    this.partner = p;
    if (typeof window !== 'undefined') {
      if (u) localStorage.setItem('user', JSON.stringify(u));
      else localStorage.removeItem('user');
      if (p) localStorage.setItem('partner', JSON.stringify(p));
      else localStorage.removeItem('partner');
    }
  }

  async init() {
    if (this.token && typeof window !== 'undefined') {
      try {
        const { API_URL } = await import('$lib/api');
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${this.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          this.setUser(data.user, data.partner || null);
        } else {
          this.logout();
        }
      } catch (e) {
        console.error('Failed to init auth', e);
      }
    }
  }

  logout() {
    this.token = null;
    this.user = null;
    this.partner = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('partner');
    }
  }
}

export const auth = new AuthState();

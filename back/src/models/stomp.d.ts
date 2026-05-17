export interface StompFrame {
  command: string;
  headers: Record<string, string>;
  body: string;
}

export interface Subscription {
  destination: string;
  cancel: () => void;
}

export interface Session {
  subs: Map<string, Subscription>;
}

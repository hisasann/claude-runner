export interface Issue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: Label[];
  assignee: User | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface Label {
  name: string;
  color: string;
  description: string | null;
}

export interface User {
  login: string;
  id: number;
  avatar_url: string;
}

export interface PullRequest {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
}

export interface PRParams {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
}

export interface Comment {
  id: number;
  body: string;
  user: User;
  created_at: string;
}

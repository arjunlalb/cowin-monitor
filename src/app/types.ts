export interface State {
  state_id: string;
  state_name: string;
}

export interface Dictionary<T> {
  [key: string]: T;
}

export interface District {
  district_id: string;
  district_name: string;
}

export interface Center {
  name: string;
  pincode: string;
  sessions: Session[]
}

export interface Session {
  available_capacity: number;
  min_age_limit: number;
}

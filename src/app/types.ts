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

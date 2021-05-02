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
  id: number;
  name: string;
  pincode: string;
  fee_type : string;
  sessions: Session[];
  vaccine_fees: {
    vaccine: string;
    fee: number;
  }[]
}

export interface Session {
  available_capacity: number;
  min_age_limit: number;
  vaccine: string;
  date: string;
}

export enum FeeTypeFilter  {
  FreeAndPaid = 'Free and Paid',
  OnlyPaid = 'Only Paid',
  OnlyFree = 'Only Free'
}

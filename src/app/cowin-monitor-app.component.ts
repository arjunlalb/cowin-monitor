import {HttpClient} from '@angular/common/http';
import {Component} from '@angular/core';
import {finalize, map} from 'rxjs/operators';
import {CONSTANTS} from './constants';
import {Center, Dictionary, District, FeeTypeFilter, State} from './types';

@Component({
  selector: 'app-cowin-monitor',
  styleUrls: ['./cowin-monitor-app.component.scss'],
  template: `
    <div class="app-cowin-monitor">
      <div class="disclaimer">
        <p class="disclaimer-line">Disclaimer : This app is intended to serve only as a way to quickly find availability for a certain date. User will have to book their
          vaccination slots via the official channels like Aarogya Setu app, Co-Win portal/app etc. </p>
        <p class="disclaimer-line">To know exact status of availability per age group, please refer to the above said official apps. Data is fetched in real time from Co-WIN Public
          APIs as mentioned <a href="https://apisetu.gov.in/public/api/cowin#">here</a> (as on 2 May 2021).</p>
        <p class="disclaimer-line">Developed by <a href="http://www.arjunlal.in">Arjun</a>. If you notice any bugs or have suggestions, reach out to me on <a
          href="https://twitter.com/arjunlal_">Twitter</a> or <a href="https://linkedin.com/in/arjunlalb">LinkedIn</a>.</p>
      </div>

      <div class="header-section">
        <div class="state-select-section">
          <h4>State : </h4>
          <select class="select" name="state" [ngModel]="this.selectedStateId" (ngModelChange)="this.setState($event)">
            <option value="" disabled selected>Select a state</option>
            <option *ngFor="let state of this.states" [value]="state.state_id">{{state.state_name}}</option>
          </select>
        </div>

        <div class="district-select-section">
          <h4>District : </h4>
          <select class="select" name="district" [ngModel]="this.selectedDistrictId" (ngModelChange)="this.setDistrict($event)">
            <option value="" disabled selected>{{ this.selectedStateId ? 'Select a district' : 'Select a state to see districts'}}</option>
            <option *ngFor="let district of this.districts" [value]="district.district_id">{{district.district_name}}</option>
          </select>
        </div>

        <div class="date-select-section">
          <h4>Date : </h4>
          <input class="input" type="date" [ngModel]="this.selectedDate" (ngModelChange)="this.setDate($event)">
        </div>

        <div class="action-button-section">
          <button class="button" (click)="this.getSlotInformation()" [disabled]="!this.enableButton()">Check</button>
        </div>
      </div>

      <div class="legend-section">
        <div class="legend">
          <div class="marker available"></div>
          <div>Available {{ this.centersWithAvailability !== undefined ? (this.centersWithAvailability) : ''}}</div>
        </div>

        <div class="legend">
          <div class="marker not-available"></div>
          <div>Not Available {{ this.centersWithoutAvailability !== undefined ? (this.centersWithoutAvailability) : ''}}</div>
        </div>
      </div>

      <div *ngIf="this.centers?.length === 0 && this.requestInProgress === false">No vaccination centers available at the moment.</div>
      <div *ngIf="this.requestInProgress">Fetching data ...</div>

      <div class="filter-section" *ngIf="this.centers?.length > 0">
        <div class="fee-type-filter">
          <select class="select" name="Filter by fee type" [(ngModel)]="this.feeTypeFilter" (ngModelChange)="this.filterCenters()">
            <option *ngFor="let feeTypeFilterOption of this.feeTypeFilterOptions" [value]="feeTypeFilterOption">{{ feeTypeFilterOption }}</option>
          </select>
        </div>
      </div>
      
      <div class="vaccination-centers-info">
        <div class="vaccination-center-card" *ngFor="let center of this.centers" [ngClass]="this.getAvailableCapacity(center) > 0 ? 'available' : 'not-available'">

          <p class="center-name">{{ center.name }}</p>
          <div class="info-row"><p>({{this.getAgeEligibility(center)}}+)</p>
            <div class="fee-type-label">{{ center.fee_type }}</div>
          </div>
          <p class="pin-code">Pincode : {{ center.pincode}}</p>
          <p class="capacity">Available Capacity : {{ this.getAvailableCapacity(center)}}</p>
        </div>
      </div>
    </div>
  `
})
export class CowinMonitorAppComponent {
  public dataSet: Center[];
  public requestInProgress: boolean = false;

  public selectedStateId: string = '';
  public selectedDistrictId: string = '';
  public selectedDate: string = '';
  public formattedDate: string = '';
  public centersWithAvailability?: number;
  public centersWithoutAvailability?: number;
  public feeTypeFilter: FeeTypeFilter = FeeTypeFilter.FreeAndPaid;

  public states: State[] = [];
  public districts: District[] = [];
  public centers: Center[];

  public feeTypeFilterOptions: FeeTypeFilter[] = Object.values(FeeTypeFilter);
  public constructor(private readonly httpClient: HttpClient) {
    this.getStates();
  }

  public setState(stateId: string): void {
    this.selectedStateId = stateId;
    this.getDistricts();
  }

  public setDistrict(districtId: string): void {
    this.selectedDistrictId = districtId;
  }

  public setDate(date: string): void {
    this.selectedDate = date;
    this.formattedDate = this.convertDateToDdMmYyyy(date);
  }

  private convertDateToDdMmYyyy(date: string): string {
    return date.split('-').reverse().join('-');
  }

  public enableButton(): boolean {
    return this.selectedDistrictId !== '' && this.selectedDate !== '';
  }

  public getSlotInformation(): void {
    this.requestInProgress = true;
    this.centers = [];
    this.dataSet = [];
    this.httpClient.get(`${CONSTANTS.URL_PREFIX}/appointment/sessions/public/calendarByDistrict?district_id=${this.selectedDistrictId}&date=${this.formattedDate}`)
      .pipe(map((data: Dictionary<unknown>) => data.centers as Center[]), finalize(() => { this.requestInProgress = false;}))
      .subscribe((data: Center[]) => {
        this.centers = data.sort((center1, center2) => (center1.name as string).localeCompare(center2.name as string));
        this.dataSet = [...this.centers];
        this.initMetadata();
      });
  }

  private initMetadata(): void {
    this.centersWithAvailability = this.centers.filter(center => this.getAvailableCapacity(center) > 0).length;
    this.centersWithoutAvailability = this.centers.filter(center => this.getAvailableCapacity(center) === 0).length;
  }

  public filterCenters(): void {
    if (this.feeTypeFilter === FeeTypeFilter.FreeAndPaid) {
      this.centers = [ ...this.dataSet ];
    } else if (this.feeTypeFilter === FeeTypeFilter.OnlyPaid) {
      this.centers = this.dataSet.filter(center => center.fee_type === 'Paid');
    } else {
      this.centers = this.dataSet.filter(center => center.fee_type === 'Free');
    }

    this.initMetadata();
  }

  public getAvailableCapacity(center: Center): number {
    return center.sessions[0].available_capacity;
  }

  public getAgeEligibility(center: Center): number {
    return center.sessions[0].min_age_limit;
  }

  private getStates(): void {
    this.httpClient.get(`${CONSTANTS.URL_PREFIX}/admin/location/states`)
      .pipe(map((data: Dictionary<unknown>) => data.states as State[])).subscribe((states: State[]) => this.states = states);
  }

  private getDistricts(): void {
    this.httpClient.get(`${CONSTANTS.URL_PREFIX}/admin/location/districts/${this.selectedStateId}`)
      .pipe(map((data: Dictionary<unknown>) => data.districts as District[]))
      .subscribe((data: District[]) => { this.districts = data});
  }
}

import {HttpClient} from '@angular/common/http';
import {Component, OnInit} from '@angular/core';
import {forkJoin, Observable} from 'rxjs';
import {finalize, map} from 'rxjs/operators';
import {CONSTANTS} from './constants';
import {Center, Dictionary, District, FeeTypeFilter, SelectOption, State} from './types';

enum View {
  ByDate,
  ByCenter
}

@Component({
  selector: 'app-cowin-monitor',
  styleUrls: ['./cowin-monitor-app.component.scss'],
  template: `
    <div class="app-cowin-monitor">
      <div class="disclaimer">
        <p class="disclaimer-line">Disclaimer : This app is intended to serve only as a way to quickly find vaccine availability information. User will have to book their
          vaccination slots via the official channels like Aarogya Setu app, CoWin portal/app etc. </p>
        <p class="disclaimer-line">Data is fetched in real time from <a href="https://apisetu.gov.in/public/api/cowin#">CoWin Public APIs</a>. Built on API specs as on 2 May 2021.
        </p>
        <p class="disclaimer-line"> If you notice any bugs or have suggestions, reach out to me on <a
          href="https://twitter.com/arjunlal_">Twitter</a> or <a href="https://linkedin.com/in/arjunlalb">LinkedIn</a> or create an issue in the project repo on <a
          href="https://github.com/arjunlalb/cowin-monitor">github</a>.</p>
      </div>
      <div class="title-section"><h2>Find Vaccine Availability By District</h2></div>
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
          <button class="button" (click)="this.getSlotInformation()" [disabled]="!this.enableCheckButton()">Check</button>
        </div>

        <div class="action-button-section">
          <button class="button" (click)="this.populateNextAvailabilityInfo()" [disabled]="this.selectedDistrictId === ''">Show future availability</button>
        </div>
      </div>

      <div class="filter-section">
        <div class="fee-type-filter">
          <h4 class="item-title">Filter by fee type</h4>
          <select class="select" name="Filter by fee type" [(ngModel)]="this.feeTypeFilter" (ngModelChange)="this.filterCenters()">
            <option *ngFor="let feeTypeFilterOption of this.feeTypeFilterOptions" [value]="feeTypeFilterOption">{{ feeTypeFilterOption }}</option>
          </select>
        </div>

        <div class="eligibility-filter">
          <h4 class="item-title">Filter by eligibility</h4>
          <select class="select" name="Filter by fee type" [(ngModel)]="this.eligibilityAgeFilter" (ngModelChange)="this.filterCenters()">
            <option *ngFor="let ageFilterOption of this.ageFilterOptions" [value]="ageFilterOption">{{ ageFilterOption }}+</option>
          </select>
        </div>

        <div class="vaccine-type-filter">
          <h4 class="item-title">Filter by Vaccine type</h4>
          <select class="select" name="Filter by vaccine type" [(ngModel)]="this.vaccineTypeFilter" (ngModelChange)="this.filterCenters()">
            <option *ngFor="let vaccineFilterOption of this.vaccineTypeOptions" [value]="vaccineFilterOption.value">{{ vaccineFilterOption.label }}</option>
          </select>
        </div>
        
        <div class="search-filter">
          <h4 class="item-title">Search by center name or pin code</h4>
          <input class="input search-box" type="text" placeholder="Type here" [(ngModel)]="this.searchText" (ngModelChange)="this.filterCenters()">
        </div>

        <div class="availability-filter">
          <input type="checkbox" [(ngModel)]="this.filterByAvailability" (ngModelChange)="this.filterCenters()">
          <span class="item-title">Show only available centers</span>
        </div>
      </div>

      <div *ngIf="this.fetchTime !== undefined" class="legend-section">
        <div class="legend">
          <div class="legend-item">
            <div class="status-text">Total No. Of Centers</div>
            <div class="count">{{ this.centers?.length }}</div>
          </div>

          <div class="legend-item available">
            <div class="status-text">Available</div>
            <div class="count">{{ this.centersWithAvailability }}</div>
          </div>
        </div>

        <div class="legend">
          <div class="legend-item not-available">
            <div class="status-text">Not Available</div>
            <div class="count">{{ this.centersWithoutAvailability }}</div>
          </div>
        </div>
      </div>

      <div *ngIf="this.requestInProgress">Fetching data ...</div>

      <div class="info-message-section" *ngIf="this.requestInProgress === false && this.fetchTime">
        <div *ngIf="this.centers?.length === 0">No vaccination centers matching this criteria found at the moment.</div>
        <div *ngIf="this.isCenterView()">Displayed data is the availability status for next 2 months, starting tomorrow({{this.baseDateForProjection}}).
        </div>
        <div>Data last fetched on {{ this.fetchTime?.toLocaleDateString() }}, {{ this.fetchTime?.toLocaleTimeString()}}</div>
      </div>

      <div class="results-section">
        <div *ngIf="this.shouldShowDaySwitchers && !this.isCenterView()" class="date-switchers-section">
          <button class="button" (click)="this.goToPreviousDay()">< Previous Day</button>
          <button class="button" (click)="this.goToNextDay()">Next Day ></button>
        </div>

        <div class="vaccination-centers-info">
          <div class="vaccination-center-card" *ngFor="let center of this.centers" [ngClass]="this.getAvailableCapacity(center) > 0 ? 'available' : 'not-available'">
            <p class="center-name">{{ center.name }}</p>
            <div class="info-row"><p>({{this.getAgeEligibility(center)}}+)</p>
              <div class="fee-type-label">{{ center.fee_type }}</div>
            </div>
            <p class="pin-code">Pincode : {{ center.pincode}}</p>
            <p class="capacity">Available Doses : {{ this.getAvailableCapacity(center)}}</p>
            <p *ngIf="center.sessions[0]?.vaccine" class="vaccine-details" [ngClass]="center.sessions[0].vaccine">{{ this.getVaccineDetails(center)}} </p>
            <p *ngIf="this.isCenterView()" class="availability">Available on : {{this.getAvailabilityDateDisplayString(center.sessions[0]?.date)}}</p>
            <button *ngIf="this.getAvailableCapacity(center) > 0" class="button book-now-button" (click)="this.goToCowinPortal()">Book Now</button>
          </div>

        </div>
      </div>
    </div>
  `
})
export class CowinMonitorAppComponent implements OnInit {
  public dataSet: Center[];
  public requestInProgress: boolean = false;

  public selectedStateId: string = '';
  public selectedDistrictId: string = '';
  public selectedDate: string = '';
  public formattedDate: string = '';
  public centersWithAvailability: number = 0;
  public centersWithoutAvailability: number = 0;
  public feeTypeFilter: FeeTypeFilter = FeeTypeFilter.FreeAndPaid;
  public eligibilityAgeFilter: number = 45;
  public filterByAvailability: boolean = false;
  public dataView: View = View.ByDate;
  public baseDateForProjection: string = '';
  public fetchTime: Date;
  public states: State[] = [];
  public districts: District[] = [];
  public centers: Center[];
  public searchText: string = '';
  public vaccineTypeFilter: string = '';

  public feeTypeFilterOptions: FeeTypeFilter[] = [FeeTypeFilter.FreeAndPaid, FeeTypeFilter.OnlyFree, FeeTypeFilter.OnlyPaid];
  public vaccineTypeOptions: SelectOption[] = [{ label: 'Any', value: ''}, { label: 'Covishield', value: 'Covishield'}, { label: 'Covaxin', value: 'Covaxin'}]
  public ageFilterOptions: number[] = [18, 45];
  public shouldShowDaySwitchers: boolean = false;

  private nextAvailabilityInformation: Map<number, Center> = new Map<number, Center>();
  public constructor(private readonly httpClient: HttpClient) {
    this.getStates();
  }

  public ngOnInit(): void {
    const stateId = this.getCookie(CONSTANTS.COOKIE_KEY_STATE);
    if (stateId) {
      this.setState(stateId);
    }

    const districtId = this.getCookie(CONSTANTS.COOKIE_KEY_DISTRICT);
    if (districtId) {
      this.setDistrict(districtId);
    }

    const dateString = this.getCookie(CONSTANTS.COOKIE_KEY_DATE);
    const targetDate = new Date(dateString);
    const today = new Date();
    today.setHours(0,0,0,0);
    if(dateString && targetDate.getTime() >= today.getTime()) {
      this.setDate(dateString);
    }
  }

  private setCookie(key: string, value: string): void {
    document.cookie = `${key}=${value};max-age=${60*60*24*365}`
  }

  private getCookie(key: string): string | undefined {
    return document.cookie.split(';').find(row => row.trim().startsWith(key))?.split('=')?.[1];
  }

  public setState(stateId: string): void {
    this.selectedStateId = stateId;
    this.setCookie(CONSTANTS.COOKIE_KEY_STATE, this.selectedStateId);
    this.getDistricts();
  }

  public setDistrict(districtId: string): void {
    this.selectedDistrictId = districtId;
    this.setCookie(CONSTANTS.COOKIE_KEY_DISTRICT, this.selectedDistrictId);
  }

  public goToCowinPortal(): void {
    window.open(CONSTANTS.REGISTRATION_URL, "_blank");
  }

  public setDate(date: string): void {
    this.selectedDate = date;
    this.setCookie(CONSTANTS.COOKIE_KEY_DATE, this.selectedDate);
    this.formattedDate = this.convertDateToDdMmYyyy(date);
  }

  private convertDateToDdMmYyyy(date: string): string {
    return date.split('-').reverse().join('-');
  }

  public goToNextDay(): void {
    this.setDateAndRefresh(this.buildOffsetDate(new Date(this.selectedDate), 1));
  }

  public isCenterView(): boolean {
    return this.dataView === View.ByCenter;
  }
  public goToPreviousDay(): void {
    this.setDateAndRefresh(this.buildOffsetDate(new Date(this.selectedDate), -1));
  }

  private setDateAndRefresh(date: Date): void {
    this.setDate(this.buildDateString(date));
    this.getSlotInformation();
  }

  private buildOffsetDate(date: Date, offsetValue: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetValue);
  }

  private buildDateString(date: Date): string {
    return [
      date.getFullYear(),
      // tslint:disable-next-line:prefer-template
      ('0' + (date.getMonth() + 1)).slice(-2),
      // tslint:disable-next-line:prefer-template
      ('0' + date.getDate()).slice(-2)
    ].join('-');
  }

  public enableCheckButton(): boolean {
    return this.selectedDistrictId !== '' && this.selectedDate !== '';
  }

  public getVaccineDetails(center: Center): string {
    const vaccineName: string = center.sessions?.[0]?.vaccine;

    if (vaccineName === '') {
      return '!';
    }

    const fee: string | number = (center.vaccine_fees?.find(vaccineFee => vaccineFee.vaccine === vaccineName)?.fee ?? '');

    if (fee) {
      return [vaccineName, `${fee} Rs`].join(' : ');
    }

    return vaccineName;
  }

  private buildCalendarUrl(districtId: string, date: string): string {
    return `${CONSTANTS.API_URL_PREFIX}/appointment/sessions/public/calendarByDistrict?district_id=${districtId}&date=${date}`;
  }

  public getAvailabilityDateDisplayString(date: string | undefined): string {
    if (date) {
      return date;
    }

    return 'No slots found';
  }

  public getSlotInformation(): void {
    this.dataView = View.ByDate;
    this.searchText = '';
    this.resetMetadata();
    this.requestInProgress = true;
    this.centers = [];
    this.dataSet = [];
    this.httpClient.get(`${this.buildCalendarUrl(this.selectedDistrictId, this.formattedDate)}`)
      .pipe(map((data: Dictionary<unknown>) => data.centers as Center[]), finalize(() => { this.requestInProgress = false; this.shouldShowDaySwitchers = true;}))
      .subscribe((data: Center[]) => {
        this.fetchTime = new Date();
        this.centers = data.sort(this.getSortCenterByNameFn());
        this.dataSet = [...this.centers];
        this.filterCenters();
      });
  }

  private getSortCenterByNameFn(): (center1: Center, center2: Center) => number {
    return (center1, center2) => (center1.name as string).localeCompare(center2.name as string)
  }

  public populateNextAvailabilityInfo(): void {
    this.resetMetadata();
    this.searchText = '';
    this.requestInProgress = true;
    this.dataView = View.ByCenter;
    const tomorrow: Date = this.buildOffsetDate(new Date(), 1);
    this.baseDateForProjection = this.convertDateToDdMmYyyy(this.buildDateString(tomorrow));
    this.nextAvailabilityInformation = new Map<number, Center>();

    const dataObservables$: Observable<Center[]>[] = []
    for (let i = 0; i< 8; i++) {
      dataObservables$.push(this.httpClient.get(`${this.buildCalendarUrl(this.selectedDistrictId, this.convertDateToDdMmYyyy(this.buildDateString(this.buildOffsetDate(tomorrow, i * 7))))}`)
        .pipe(
          map((data: Dictionary<unknown>) => data.centers as Center[])));
    }

    forkJoin(dataObservables$).pipe(finalize(() => this.requestInProgress = false)).subscribe(resultList => {
      this.fetchTime = new Date();
      resultList.forEach((centers: Center[]) => {
        centers.forEach(center => {
          const existingCenterInfo: Center = this.nextAvailabilityInformation.get(center.center_id);
          if (existingCenterInfo === undefined) {
            this.nextAvailabilityInformation.set(center.center_id, this.removeUnavailableSessionsFromCenter(center))
          } else {
            this.nextAvailabilityInformation.set(center.center_id, {
              ...existingCenterInfo, sessions: existingCenterInfo.sessions.concat(...this.removeUnavailableSessionsFromCenter(center).sessions)
            })
          }
        })
      });

      this.computeCenterAvailabilityData();
    })
  }

  public computeCenterAvailabilityData(): void {
    this.centers = this.getAvailabilityInfoForDisplay().sort(this.getSortCenterByNameFn());
    this.dataSet = [...this.centers ];
    this.filterCenters();
  }

  public getAvailabilityInfoForDisplay(): Center[] {
    const availabilityInfo: Center[] = Array.from(this.nextAvailabilityInformation.values());
    availabilityInfo.sort(this.getSortCenterByNameFn())
    availabilityInfo.forEach(center => {
      center.sessions = center.sessions.sort((session1, session2) => new Date(session1.date).getMilliseconds() - new Date(session2.date).getMilliseconds())
    })

    return availabilityInfo;
  }

  private removeUnavailableSessionsFromCenter(center: Center): Center {
    return { ...center, sessions: center.sessions.filter(session => session.available_capacity > 0)};
  }

  private initMetadata(): void {
    if (this.dataView === View.ByDate) {
      this.centersWithAvailability = this.centers.filter(center => this.getAvailableCapacity(center) > 0).length;
      this.centersWithoutAvailability = this.centers.filter(center => this.getAvailableCapacity(center) === 0).length;
    } else {
      this.centersWithAvailability = this.centers.filter(center => this.getAvailableCapacityForFutureDates(center) > 0).length;
      this.centersWithoutAvailability = this.centers.filter(center => this.getAvailableCapacityForFutureDates(center) === 0).length;
    }
  }

  private resetMetadata(): void {
    this.centersWithAvailability = 0;
    this.centersWithoutAvailability = 0;
  }

  public filterCenters(): void {
    // Fee type filter
    let filteredList: Center[];
    switch (this.feeTypeFilter) {
      case FeeTypeFilter.OnlyPaid:
        filteredList = this.dataSet.filter(center => center.fee_type === 'Paid');
        break;
      case FeeTypeFilter.OnlyFree:
        filteredList = this.dataSet.filter(center => center.fee_type === 'Free');
        break;
      case FeeTypeFilter.FreeAndPaid:
      default:
        filteredList = [...this.dataSet];
    }

    // Eligibility age filter
    // tslint:disable-next-line:triple-equals
    filteredList = this.eligibilityAgeFilter == 18 ? filteredList.filter(center => this.getAgeEligibility(center) === 18) : filteredList;
    
    // Search filter
    filteredList = this.searchText === ''
      ? filteredList
      : filteredList.filter(center =>
        center.name.toLowerCase().includes(this.searchText.toLowerCase())
        || center.pincode.toString().toLowerCase().includes(this.searchText.toLowerCase())
      );

    // Vaccine type filter
    filteredList = this.vaccineTypeFilter === '' ? filteredList : filteredList.filter(center => (center.sessions[0]?.vaccine ?? '').toLowerCase() === this.vaccineTypeFilter.toLowerCase());
    
    // Availability filter
    this.centers = this.filterByAvailability ? filteredList.filter(center => this.getAvailableCapacity(center) > 0) : filteredList;

    this.initMetadata();
  }

  public getAvailableCapacity(center: Center): number {
    return center.sessions[0]?.available_capacity ?? 0;
  }

  private getAvailableCapacityForFutureDates(center: Center): number {
    return center.sessions.map(session => session.available_capacity).reduce((capacity1, capacity2) => capacity1 + capacity2, 0) ?? 0;
  }

  public getAgeEligibility(center: Center): number {
    return center.sessions[0]?.min_age_limit ?? 45;
  }

  private getStates(): void {
    this.httpClient.get(`${CONSTANTS.API_URL_PREFIX}/admin/location/states`)
      .pipe(map((data: Dictionary<unknown>) => data.states as State[])).subscribe((states: State[]) => { this.states = states; });
  }

  private getDistricts(): void {
    this.httpClient.get(`${CONSTANTS.API_URL_PREFIX}/admin/location/districts/${this.selectedStateId}`)
      .pipe(map((data: Dictionary<unknown>) => data.districts as District[]))
      .subscribe((data: District[]) => { this.districts = data; });
  }
}

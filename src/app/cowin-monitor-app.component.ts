import {HttpClient} from '@angular/common/http';
import {Component} from '@angular/core';
import {EMPTY, forkJoin, Observable} from 'rxjs';
import {catchError, finalize, map} from 'rxjs/operators';
import {CONSTANTS} from './constants';
import {Center, Dictionary, District, FeeTypeFilter, State} from './types';

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
        <p class="disclaimer-line">Data is fetched in real time from <a href="https://apisetu.gov.in/public/api/cowin#">CoWin Public APIs</a>.</p>
        <p class="disclaimer-line"> Built on API specs as on 2 May 2021. If you notice any bugs or have suggestions, reach out to me on <a
          href="https://twitter.com/arjunlal_">Twitter</a> or <a href="https://linkedin.com/in/arjunlalb">LinkedIn</a>. Source on <a href="https://github.com/arjunlalb/cowin-monitor">github</a>.</p>
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
          <button class="button" (click)="this.getSlotInformation()" [disabled]="!this.enableCheckButton()">Check</button>
        </div>

        <div class="action-button-section">
          <button class="button" (click)="this.populateNextAvailabilityInfo()" [disabled]="this.selectedDistrictId === ''">See availability by centres</button>
        </div>
      </div>

      <div class="filter-section">
        <div class="fee-type-filter">
          <h4>Filter by fee type</h4>
          <select class="select" name="Filter by fee type" [(ngModel)]="this.feeTypeFilter" (ngModelChange)="this.filterCenters()">
            <option *ngFor="let feeTypeFilterOption of this.feeTypeFilterOptions" [value]="feeTypeFilterOption">{{ feeTypeFilterOption }}</option>
          </select>
        </div>

        <div class="eligibility-filter">
          <h4>Filter by eligibility</h4>
          <select class="select" name="Filter by fee type" [(ngModel)]="this.eligibilityAgeFilter" (ngModelChange)="this.filterCenters()">
            <option *ngFor="let ageFilterOption of this.ageFilterOptions" [value]="ageFilterOption">{{ ageFilterOption }}+</option>
          </select>
        </div>

        <div class="availability-filter">
          <input type="checkbox" [(ngModel)]="this.filterByAvailability" (ngModelChange)="this.filterCenters()">
          <span>Show only available centers</span>
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

      <div class="metadata-section">
        <button *ngIf="this.shouldShowDaySwitchers && !this.isCenterView()" class="button" (click)="this.goToPreviousDay()">Previous Day</button>
        <div *ngIf="this.centers?.length === 0 && this.requestInProgress === false">No vaccination centers matching this criteria available at the moment.</div>
        <div *ngIf="this.centers?.length > 0 && this.requestInProgress === false">Found {{this.centers?.length}} vaccination centers. 
          <span *ngIf="this.isCenterView()">Displayed information is availability status for next 2 months, starting tomorrow {{this.baseDateForProjection}}.</span>
        </div>
        <div *ngIf="this.requestInProgress">Fetching data ...</div>
        <button *ngIf="this.shouldShowDaySwitchers && !this.isCenterView()" class="button" (click)="this.goToNextDay()">Next Day</button>
      </div>

      <div class="fetch-time-section" *ngIf="this.requestInProgress === false && this.fetchTime">
        <span>Data last fetched on {{ this.fetchTime?.toLocaleDateString() }}, {{ this.fetchTime?.toLocaleTimeString()}}</span>
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
  public eligibilityAgeFilter: number = 45;
  public filterByAvailability: boolean = false;
  public dataView: View = View.ByDate;
  public baseDateForProjection: string = '';
  public fetchTime: Date;
  public states: State[] = [];
  public districts: District[] = [];
  public centers: Center[];

  public feeTypeFilterOptions: FeeTypeFilter[] = Object.values(FeeTypeFilter);
  public ageFilterOptions: number[] = [18, 45];
  public shouldShowDaySwitchers: boolean = false;

  private nextAvailabilityInformation: Map<number, Center> = new Map<number, Center>();
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
    const vaccineName: string = center.sessions[0]?.vaccine;

    if (vaccineName === '') {
      return '!';
    }

    const fee: string | number = (center.vaccine_fees.find(vaccineFee => vaccineFee.vaccine === vaccineName)?.fee ?? '');

    if (fee) {
      return [vaccineName, `${fee} Rs`].join(' : ');
    }

    return vaccineName;
  }

  private buildCalendarUrl(districtId: string, date: string): string {
    return `${CONSTANTS.URL_PREFIX}/appointment/sessions/public/calendarByDistrict?district_id=${districtId}&date=${date}`;
  }

  public getAvailabilityDateDisplayString(date: string | undefined): string {
    if (date) {
      return date;
    }

    return 'No slots found';
  }

  public getSlotInformation(): void {
    this.dataView = View.ByDate;
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

    forkJoin(dataObservables$).subscribe(resultList => {
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
    this.centersWithAvailability = this.centers.filter(center => this.getAvailableCapacity(center) > 0).length;
    this.centersWithoutAvailability = this.centers.filter(center => this.getAvailableCapacity(center) === 0).length;
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
    filteredList = filteredList.filter(center => this.getAgeEligibility(center) == this.eligibilityAgeFilter);

    // Availability filter
    this.centers = this.filterByAvailability ? filteredList.filter(center => this.getAvailableCapacity(center) > 0) : filteredList;

    this.initMetadata();
  }

  public getAvailableCapacity(center: Center): number {
    return center.sessions[0]?.available_capacity ?? 0;
  }

  public getAgeEligibility(center: Center): number {
    return center.sessions[0]?.min_age_limit ?? 45;
  }

  private getStates(): void {
    this.httpClient.get(`${CONSTANTS.URL_PREFIX}/admin/location/states`)
      .pipe(map((data: Dictionary<unknown>) => data.states as State[])).subscribe((states: State[]) => { this.states = states; });
  }

  private getDistricts(): void {
    this.httpClient.get(`${CONSTANTS.URL_PREFIX}/admin/location/districts/${this.selectedStateId}`)
      .pipe(map((data: Dictionary<unknown>) => data.districts as District[]))
      .subscribe((data: District[]) => { this.districts = data; });
  }
}

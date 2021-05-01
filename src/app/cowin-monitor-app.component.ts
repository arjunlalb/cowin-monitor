
import { HttpClient } from '@angular/common/http';
import {Component} from '@angular/core';
import {map} from 'rxjs/operators';

import {CONSTANTS} from './constants';
import {Dictionary, District, State} from './types';

@Component({
  selector: 'app-cowin-monitor',
  styleUrls: ['./cowin-monitor-app.component.scss'],
  template: `
    <div class="app-cowin-monitor">
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

      <div class="error-message-section">
        <p class="error-message">{{ this.errorMessage }}</p>
      </div>
      
      <div class="vaccination-centers-info">
        <div class="vaccination-center-card" *ngFor="let center of this.centers">
          <h5>{{ center.name }}</h5>
        </div>
      </div>
    </div>
  `
})
export class CowinMonitorAppComponent {
  public readonly title: string = 'cowin-monitor';
  public centers: Dictionary<unknown>[];

  public selectedStateId: string = '';
  public selectedDistrictId: string = '';
  public selectedDate: string = '';
  public formattedDate: string = '';
  public errorMessage: string = '';
  
  public states: State[] = [];
  public districts: District[] = [];
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
    this.httpClient.get(`${CONSTANTS.URL_PREFIX}/appointment/sessions/public/calendarByDistrict?district_id=${this.selectedDistrictId}&date=${this.formattedDate}`)
      .pipe(map((data: Dictionary<unknown>) => data.centers as Dictionary<unknown>[]))
      .subscribe((data: Dictionary<unknown>[]) => { this.centers = data; });
  }

  private getStates(): void {
    this.httpClient.get(`${CONSTANTS.URL_PREFIX}/admin/location/states`)
      .pipe(map((data: Dictionary<unknown>) => data.states as State[])).subscribe((states: State[]) => this.states = states);
  }
  
  private getDistricts(): void {
    this.httpClient.get(`${CONSTANTS.URL_PREFIX}/admin/location/districts/${this.selectedStateId}`).pipe(map((data: Dictionary<unknown>) => data.districts as District[])).subscribe((data: District[]) => { this.districts = data});
  }
}

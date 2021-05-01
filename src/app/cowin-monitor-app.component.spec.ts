import { TestBed, async } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { CowinMonitorAppComponent } from './cowin-monitor-app.component';

describe('AppComponent', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule
      ],
      declarations: [
        CowinMonitorAppComponent
      ],
    }).compileComponents();
  }));

  it('should create the app', () => {
    const fixture = TestBed.createComponent(CowinMonitorAppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'cowin-monitor'`, () => {
    const fixture = TestBed.createComponent(CowinMonitorAppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('cowin-monitor');
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(CowinMonitorAppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('.content span').textContent).toContain('cowin-monitor app is running!');
  });
});

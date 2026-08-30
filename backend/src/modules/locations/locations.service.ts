import { Injectable } from '@nestjs/common';
import { LocationDto } from './dto/location.dto';

type NeighborhoodEntry = {
  id: string;
  name: string;
  city: string;
  zone: string;
};

const AUSTIN_NEIGHBORHOODS: NeighborhoodEntry[] = [
  {
    id: 'austin.allandale',
    name: 'Allandale',
    city: 'Austin',
    zone: 'North Austin',
  },
  {
    id: 'austin.anderson-mill',
    name: 'Anderson Mill',
    city: 'Austin',
    zone: 'North Austin',
  },
  {
    id: 'austin.avery-ranch',
    name: 'Avery Ranch',
    city: 'Austin',
    zone: 'North Austin',
  },
  {
    id: 'austin.balcones-village',
    name: 'Balcones Village',
    city: 'Austin',
    zone: 'Northwest Hills',
  },
  {
    id: 'austin.balcones-woods',
    name: 'Balcones Woods',
    city: 'Austin',
    zone: 'Northwest Hills',
  },
  {
    id: 'austin.barrington-oaks',
    name: 'Barrington Oaks',
    city: 'Austin',
    zone: 'Northwest Hills',
  },
  {
    id: 'austin.barton-creek',
    name: 'Barton Creek',
    city: 'Austin',
    zone: 'Southwest Austin',
  },
  {
    id: 'austin.barton-hills',
    name: 'Barton Hills',
    city: 'Austin',
    zone: 'South Austin',
  },
  {
    id: 'austin.battle-bend-springs',
    name: 'Battle Bend Springs',
    city: 'Austin',
    zone: 'South Austin',
  },
  {
    id: 'austin.blackland',
    name: 'Blackland',
    city: 'Austin',
    zone: 'Central Austin',
  },
  {
    id: 'austin.bouldin-creek',
    name: 'Bouldin Creek',
    city: 'Austin',
    zone: 'South Congress',
  },
  {
    id: 'austin.brentwood',
    name: 'Brentwood',
    city: 'Austin',
    zone: 'Central Austin',
  },
  {
    id: 'austin.bryker-woods',
    name: 'Bryker Woods',
    city: 'Austin',
    zone: 'Central Austin',
  },
  {
    id: 'austin.canyon-creek',
    name: 'Canyon Creek',
    city: 'Austin',
    zone: 'Northwest Hills',
  },
  {
    id: 'austin.cherrywood',
    name: 'Cherrywood',
    city: 'Austin',
    zone: 'East Austin',
  },
  {
    id: 'austin.circle-c',
    name: 'Circle C',
    city: 'Austin',
    zone: 'Southwest Austin',
  },
  {
    id: 'austin.clarksville',
    name: 'Clarksville',
    city: 'Austin',
    zone: 'Central Austin',
  },
  {
    id: 'austin.crestview',
    name: 'Crestview',
    city: 'Austin',
    zone: 'Central Austin',
  },
  { id: 'austin.domain', name: 'Domain', city: 'Austin', zone: 'North Austin' },
  { id: 'austin.downtown', name: 'Downtown', city: 'Austin', zone: 'Downtown' },
  {
    id: 'austin.east-cesar-chavez',
    name: 'East Cesar Chavez',
    city: 'Austin',
    zone: 'East Austin',
  },
  {
    id: 'austin.french-place',
    name: 'French Place',
    city: 'Austin',
    zone: 'Central Austin',
  },
  {
    id: 'austin.galindo',
    name: 'Galindo',
    city: 'Austin',
    zone: 'South Austin',
  },
  {
    id: 'austin.govalle',
    name: 'Govalle',
    city: 'Austin',
    zone: 'East Austin',
  },
  {
    id: 'austin.highland',
    name: 'Highland',
    city: 'Austin',
    zone: 'Central Austin',
  },
  { id: 'austin.holly', name: 'Holly', city: 'Austin', zone: 'East Austin' },
  {
    id: 'austin.hyde-park',
    name: 'Hyde Park',
    city: 'Austin',
    zone: 'Central Austin',
  },
  {
    id: 'austin.mueller',
    name: 'Mueller',
    city: 'Austin',
    zone: 'Central Austin',
  },
  {
    id: 'austin.north-campus',
    name: 'North Campus',
    city: 'Austin',
    zone: 'UT Campus',
  },
  {
    id: 'austin.north-shoal-creek',
    name: 'North Shoal Creek',
    city: 'Austin',
    zone: 'Northwest Hills',
  },
  {
    id: 'austin.northwest-hills',
    name: 'Northwest Hills',
    city: 'Austin',
    zone: 'Northwest Hills',
  },
  {
    id: 'austin.oak-hill',
    name: 'Oak Hill',
    city: 'Austin',
    zone: 'Southwest Austin',
  },
  {
    id: 'austin.oakmont-heights',
    name: 'Oakmont Heights',
    city: 'Austin',
    zone: 'Central Austin',
  },
  {
    id: 'austin.old-enfield',
    name: 'Old Enfield',
    city: 'Austin',
    zone: 'Central Austin',
  },
  {
    id: 'austin.old-west-austin',
    name: 'Old West Austin',
    city: 'Austin',
    zone: 'Central Austin',
  },
  {
    id: 'austin.pemberton-heights',
    name: 'Pemberton Heights',
    city: 'Austin',
    zone: 'Central Austin',
  },
  {
    id: 'austin.pflugerville',
    name: 'Pflugerville',
    city: 'Austin',
    zone: 'North Austin',
  },
  {
    id: 'austin.rainey-street',
    name: 'Rainey Street',
    city: 'Austin',
    zone: 'Downtown',
  },
  {
    id: 'austin.rosedale',
    name: 'Rosedale',
    city: 'Austin',
    zone: 'Central Austin',
  },
  {
    id: 'austin.round-rock',
    name: 'Round Rock',
    city: 'Austin',
    zone: 'North Austin',
  },
  {
    id: 'austin.shoal-creek',
    name: 'Shoal Creek',
    city: 'Austin',
    zone: 'Central Austin',
  },
  { id: 'austin.soco', name: 'SoCo', city: 'Austin', zone: 'South Congress' },
  {
    id: 'austin.south-lamar',
    name: 'South Lamar',
    city: 'Austin',
    zone: 'South Austin',
  },
  {
    id: 'austin.south-river-city',
    name: 'South River City',
    city: 'Austin',
    zone: 'South Austin',
  },
  {
    id: 'austin.sunset-valley',
    name: 'Sunset Valley',
    city: 'Austin',
    zone: 'Southwest Austin',
  },
  {
    id: 'austin.tarrytown',
    name: 'Tarrytown',
    city: 'Austin',
    zone: 'Central Austin',
  },
  {
    id: 'austin.tech-ridge',
    name: 'Tech Ridge',
    city: 'Austin',
    zone: 'North Austin',
  },
  {
    id: 'austin.travis-heights',
    name: 'Travis Heights',
    city: 'Austin',
    zone: 'South Congress',
  },
  {
    id: 'austin.university-hills',
    name: 'University Hills',
    city: 'Austin',
    zone: 'East Austin',
  },
  {
    id: 'austin.west-campus',
    name: 'West Campus',
    city: 'Austin',
    zone: 'UT Campus',
  },
  {
    id: 'austin.westgate',
    name: 'Westgate',
    city: 'Austin',
    zone: 'Southwest Austin',
  },
  {
    id: 'austin.windsor-hills',
    name: 'Windsor Hills',
    city: 'Austin',
    zone: 'North Austin',
  },
  {
    id: 'austin.windsor-park',
    name: 'Windsor Park',
    city: 'Austin',
    zone: 'Central Austin',
  },
  { id: 'austin.zilker', name: 'Zilker', city: 'Austin', zone: 'South Austin' },
  {
    id: 'austin.austin-bergstrom',
    name: 'Austin Bergstrom',
    city: 'Austin',
    zone: 'Airport',
  },
  {
    id: 'austin.cedar-park',
    name: 'Cedar Park',
    city: 'Austin',
    zone: 'North Austin',
  },
];

const HOUSTON_NEIGHBORHOODS: NeighborhoodEntry[] = [
  {
    id: 'houston.acres-homes',
    name: 'Acres Home',
    city: 'Houston',
    zone: 'North Houston',
  },
  {
    id: 'houston.addicks',
    name: 'Addicks',
    city: 'Houston',
    zone: 'West Houston',
  },
  {
    id: 'houston.afton-oaks',
    name: 'Afton Oaks',
    city: 'Houston',
    zone: 'Galleria/Uptown',
  },
  { id: 'houston.alief', name: 'Alief', city: 'Houston', zone: 'West Houston' },
  {
    id: 'houston.almeda',
    name: 'Almeda',
    city: 'Houston',
    zone: 'South Houston',
  },
  {
    id: 'houston.astrodome-area',
    name: 'Astrodome Area',
    city: 'Houston',
    zone: 'Medical Center',
  },
  {
    id: 'houston.avenida-houston',
    name: 'Avenida Houston',
    city: 'Houston',
    zone: 'Downtown',
  },
  {
    id: 'houston.bay-forest',
    name: 'Bay Forest',
    city: 'Houston',
    zone: 'Clear Lake',
  },
  {
    id: 'houston.bay-glen',
    name: 'Bay Glen',
    city: 'Houston',
    zone: 'Clear Lake',
  },
  {
    id: 'houston.bay-knoll',
    name: 'Bay Knoll',
    city: 'Houston',
    zone: 'Clear Lake',
  },
  {
    id: 'houston.bellaire',
    name: 'Bellaire',
    city: 'Houston',
    zone: 'Medical Center',
  },
  {
    id: 'houston.bellfort',
    name: 'Bellfort',
    city: 'Houston',
    zone: 'South Houston',
  },
  {
    id: 'houston.blue-ridge',
    name: 'Blue Ridge',
    city: 'Houston',
    zone: 'South Houston',
  },
  {
    id: 'houston.bordersville',
    name: 'Bordersville',
    city: 'Houston',
    zone: 'Bush IAH',
  },
  {
    id: 'houston.braeburn',
    name: 'Braeburn',
    city: 'Houston',
    zone: 'Medical Center',
  },
  {
    id: 'houston.braeswood',
    name: 'Braeswood',
    city: 'Houston',
    zone: 'Medical Center',
  },
  {
    id: 'houston.briargrove',
    name: 'Briargrove',
    city: 'Houston',
    zone: 'Galleria/Uptown',
  },
  {
    id: 'houston.briarmeadow',
    name: 'Briarmeadow',
    city: 'Houston',
    zone: 'Galleria/Uptown',
  },
  {
    id: 'houston.broadacres',
    name: 'Broadacres',
    city: 'Houston',
    zone: 'Medical Center',
  },
  {
    id: 'houston.brookhollow',
    name: 'Brookhollow',
    city: 'Houston',
    zone: 'Heights',
  },
  {
    id: 'houston.champions',
    name: 'Champions',
    city: 'Houston',
    zone: 'North Houston',
  },
  {
    id: 'houston.clear-lake',
    name: 'Clear Lake',
    city: 'Houston',
    zone: 'Clear Lake',
  },
  {
    id: 'houston.cloverland',
    name: 'Cloverland',
    city: 'Houston',
    zone: 'South Houston',
  },
  {
    id: 'houston.cottage-grove',
    name: 'Cottage Grove',
    city: 'Houston',
    zone: 'Heights',
  },
  {
    id: 'houston.downtown',
    name: 'Downtown',
    city: 'Houston',
    zone: 'Downtown',
  },
  {
    id: 'houston.east-downtown',
    name: 'East Downtown',
    city: 'Houston',
    zone: 'Downtown',
  },
  {
    id: 'houston.east-end',
    name: 'East End',
    city: 'Houston',
    zone: 'East End',
  },
  {
    id: 'houston.east-houston',
    name: 'East Houston',
    city: 'Houston',
    zone: 'East End',
  },
  {
    id: 'houston.eldridge',
    name: 'Eldridge',
    city: 'Houston',
    zone: 'West Houston',
  },
  {
    id: 'houston.energy-corridor',
    name: 'Energy Corridor',
    city: 'Houston',
    zone: 'West Houston',
  },
  {
    id: 'houston.fondren-southwest',
    name: 'Fondren Southwest',
    city: 'Houston',
    zone: 'South Houston',
  },
  {
    id: 'houston.galleria',
    name: 'Galleria',
    city: 'Houston',
    zone: 'Galleria/Uptown',
  },
  {
    id: 'houston.garden-oaks',
    name: 'Garden Oaks',
    city: 'Houston',
    zone: 'Heights',
  },
  {
    id: 'houston.glenbrook-valley',
    name: 'Glenbrook Valley',
    city: 'Houston',
    zone: 'Hobby',
  },
  {
    id: 'houston.golfcrest',
    name: 'Golfcrest',
    city: 'Houston',
    zone: 'South Houston',
  },
  {
    id: 'houston.greater-heights',
    name: 'Greater Heights',
    city: 'Houston',
    zone: 'Heights',
  },
  {
    id: 'houston.greenway-plaza',
    name: 'Greenway Plaza',
    city: 'Houston',
    zone: 'Galleria/Uptown',
  },
  {
    id: 'houston.gulfton',
    name: 'Gulfton',
    city: 'Houston',
    zone: 'Medical Center',
  },
  {
    id: 'houston.hedwig-village',
    name: 'Hedwig Village',
    city: 'Houston',
    zone: 'Galleria/Uptown',
  },
  { id: 'houston.heights', name: 'Heights', city: 'Houston', zone: 'Heights' },
  {
    id: 'houston.highland-village',
    name: 'Highland Village',
    city: 'Houston',
    zone: 'Galleria/Uptown',
  },
  {
    id: 'houston.hobby-area',
    name: 'Hobby Area',
    city: 'Houston',
    zone: 'Hobby',
  },
  { id: 'houston.humble', name: 'Humble', city: 'Houston', zone: 'Bush IAH' },
  {
    id: 'houston.independence-heights',
    name: 'Independence Heights',
    city: 'Houston',
    zone: 'Heights',
  },
  {
    id: 'houston.iah-area',
    name: 'IAH Area',
    city: 'Houston',
    zone: 'Bush IAH',
  },
  {
    id: 'houston.kashmere-gardens',
    name: 'Kashmere Gardens',
    city: 'Houston',
    zone: 'East End',
  },
  { id: 'houston.katy', name: 'Katy', city: 'Houston', zone: 'West Houston' },
  {
    id: 'houston.kingwood',
    name: 'Kingwood',
    city: 'Houston',
    zone: 'Bush IAH',
  },
  {
    id: 'houston.lakes-on-eldridge',
    name: 'Lakes on Eldridge',
    city: 'Houston',
    zone: 'West Houston',
  },
  {
    id: 'houston.lawndale',
    name: 'Lawndale',
    city: 'Houston',
    zone: 'East End',
  },
  {
    id: 'houston.little-york',
    name: 'Little York',
    city: 'Houston',
    zone: 'North Houston',
  },
  {
    id: 'houston.magnolia-park',
    name: 'Magnolia Park',
    city: 'Houston',
    zone: 'East End',
  },
  {
    id: 'houston.main-street',
    name: 'Main Street',
    city: 'Houston',
    zone: 'Downtown',
  },
  {
    id: 'houston.maplewood',
    name: 'Maplewood',
    city: 'Houston',
    zone: 'North Houston',
  },
  {
    id: 'houston.medical-center',
    name: 'Medical Center',
    city: 'Houston',
    zone: 'Medical Center',
  },
  {
    id: 'houston.memorial',
    name: 'Memorial',
    city: 'Houston',
    zone: 'Galleria/Uptown',
  },
  {
    id: 'houston.meyerland',
    name: 'Meyerland',
    city: 'Houston',
    zone: 'Medical Center',
  },
  { id: 'houston.midtown', name: 'Midtown', city: 'Houston', zone: 'Downtown' },
  {
    id: 'houston.missouri-city',
    name: 'Missouri City',
    city: 'Houston',
    zone: 'Sugar Land / SW',
  },
  {
    id: 'houston.montrose',
    name: 'Montrose',
    city: 'Houston',
    zone: 'Montrose',
  },
  {
    id: 'houston.museum-district',
    name: 'Museum District',
    city: 'Houston',
    zone: 'Medical Center',
  },
  {
    id: 'houston.near-northside',
    name: 'Near Northside',
    city: 'Houston',
    zone: 'Heights',
  },
  {
    id: 'houston.neartown',
    name: 'Neartown',
    city: 'Houston',
    zone: 'Montrose',
  },
  {
    id: 'houston.northside',
    name: 'Northside',
    city: 'Houston',
    zone: 'North Houston',
  },
  {
    id: 'houston.northline',
    name: 'Northline',
    city: 'Houston',
    zone: 'North Houston',
  },
  {
    id: 'houston.oak-forest',
    name: 'Oak Forest',
    city: 'Houston',
    zone: 'Heights',
  },
  {
    id: 'houston.park-place',
    name: 'Park Place',
    city: 'Houston',
    zone: 'Hobby',
  },
  { id: 'houston.pearland', name: 'Pearland', city: 'Houston', zone: 'Hobby' },
  {
    id: 'houston.pleasantville',
    name: 'Pleasantville',
    city: 'Houston',
    zone: 'East End',
  },
  {
    id: 'houston.rice-military',
    name: 'Rice Military',
    city: 'Houston',
    zone: 'Montrose',
  },
  {
    id: 'houston.rice-village',
    name: 'Rice Village',
    city: 'Houston',
    zone: 'Medical Center',
  },
  {
    id: 'houston.river-oaks',
    name: 'River Oaks',
    city: 'Houston',
    zone: 'Galleria/Uptown',
  },
  {
    id: 'houston.second-ward',
    name: 'Second Ward',
    city: 'Houston',
    zone: 'East End',
  },
  {
    id: 'houston.sharpstown',
    name: 'Sharpstown',
    city: 'Houston',
    zone: 'Medical Center',
  },
  {
    id: 'houston.south-houston',
    name: 'South Houston',
    city: 'Houston',
    zone: 'Hobby',
  },
  {
    id: 'houston.south-main',
    name: 'South Main',
    city: 'Houston',
    zone: 'Medical Center',
  },
  {
    id: 'houston.south-park',
    name: 'South Park',
    city: 'Houston',
    zone: 'South Houston',
  },
  {
    id: 'houston.southampton',
    name: 'Southampton',
    city: 'Houston',
    zone: 'Montrose',
  },
  {
    id: 'houston.spring-branch',
    name: 'Spring Branch',
    city: 'Houston',
    zone: 'West Houston',
  },
  {
    id: 'houston.stafford',
    name: 'Stafford',
    city: 'Houston',
    zone: 'Sugar Land / SW',
  },
  {
    id: 'houston.sugar-land',
    name: 'Sugar Land',
    city: 'Houston',
    zone: 'Sugar Land / SW',
  },
  {
    id: 'houston.sunny-side',
    name: 'Sunnyside',
    city: 'Houston',
    zone: 'South Houston',
  },
  {
    id: 'houston.theater-district',
    name: 'Theater District',
    city: 'Houston',
    zone: 'Downtown',
  },
  {
    id: 'houston.third-ward',
    name: 'Third Ward',
    city: 'Houston',
    zone: 'Medical Center',
  },
  {
    id: 'houston.timbergrove',
    name: 'Timbergrove',
    city: 'Houston',
    zone: 'Heights',
  },
  {
    id: 'houston.uptown',
    name: 'Uptown',
    city: 'Houston',
    zone: 'Galleria/Uptown',
  },
  {
    id: 'houston.washington-ave',
    name: 'Washington Ave',
    city: 'Houston',
    zone: 'Montrose',
  },
  {
    id: 'houston.west-university',
    name: 'West University',
    city: 'Houston',
    zone: 'Montrose',
  },
  {
    id: 'houston.westbury',
    name: 'Westbury',
    city: 'Houston',
    zone: 'Medical Center',
  },
  {
    id: 'houston.westchase',
    name: 'Westchase',
    city: 'Houston',
    zone: 'West Houston',
  },
  {
    id: 'houston.westwood',
    name: 'Westwood',
    city: 'Houston',
    zone: 'South Houston',
  },
  {
    id: 'houston.willowbrook',
    name: 'Willowbrook',
    city: 'Houston',
    zone: 'North Houston',
  },
  {
    id: 'houston.woodland-heights',
    name: 'Woodland Heights',
    city: 'Houston',
    zone: 'Heights',
  },
];

@Injectable()
export class LocationsService {
  private readonly neighborhoods: Map<string, NeighborhoodEntry[]>;

  constructor() {
    this.neighborhoods = new Map([
      ['Austin', AUSTIN_NEIGHBORHOODS],
      ['Houston', HOUSTON_NEIGHBORHOODS],
    ]);
  }

  getNeighborhoods(city: string, search?: string): LocationDto[] {
    const list = this.neighborhoods.get(city);
    if (!list) return [];

    let filtered = list;
    if (search) {
      const q = search.toLowerCase();
      filtered = list.filter(
        (n) =>
          n.name.toLowerCase().includes(q) || n.zone.toLowerCase().includes(q),
      );
    }

    return filtered.map((n) => ({
      id: n.id,
      name: n.name,
      city: n.city,
      zone: n.zone,
    }));
  }

  getCities(): string[] {
    return Array.from(this.neighborhoods.keys());
  }
}

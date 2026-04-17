export interface CompetitiveRaceEntry {
  raceId: string;
  label: string;
  party: 'D' | 'R';
}

export interface RatingGroup {
  rating: string;
  races: CompetitiveRaceEntry[];
  demSeats: number;
  repSeats: number;
}

export interface CompetitiveRacesData {
  house: RatingGroup[];
  senate: RatingGroup[];
}

export interface BalanceSegment {
  label: string;
  count: number;
  color: string;
}

export interface ChamberBalance {
  total: number;
  majority: number;
  segments: BalanceSegment[];
}

// House: 435 total, 218 to win majority
// Senate: 100 total, 51 to win majority
// Seat counts: non-competitive derived from 2024 results (D=215 H / 47 S, R=220 H / 53 S)
// minus competitive seats held by each party
export const CHAMBER_BALANCE: Record<string, ChamberBalance> = {
  house: {
    total: 435,
    majority: 218,
    segments: [
      { label: 'Solid D', count: 197, color: '#1e4b8e' },
      { label: 'Lean D', count: 14, color: '#6fa4e8' },
      { label: 'Toss Up', count: 18, color: '#b0b0b0' },
      { label: 'Lean R', count: 4, color: '#e88a8a' },
      { label: 'Solid R', count: 202, color: '#b82020' },
    ],
  },
  senate: {
    total: 100,
    majority: 51,
    segments: [
      { label: 'Solid D', count: 44, color: '#1e4b8e' },
      { label: 'Lean D', count: 1, color: '#6fa4e8' },
      { label: 'Toss Up', count: 4, color: '#b0b0b0' },
      { label: 'Lean R', count: 2, color: '#e88a8a' },
      { label: 'Solid R', count: 49, color: '#b82020' },
    ],
  },
};

export const COMPETITIVE_RACES: CompetitiveRacesData = {
  house: [
    {
      rating: 'Lean D',
      demSeats: 13,
      repSeats: 1,
      races: [
        { raceId: 'CA-13', label: 'Gray', party: 'D' },
        { raceId: 'CA-45', label: 'Tran', party: 'D' },
        { raceId: 'FL-23', label: 'Moskowitz', party: 'D' },
        { raceId: 'MI-8', label: 'McDonald Rivet', party: 'D' },
        { raceId: 'NE-2', label: 'OPEN (Bacon)', party: 'R' },
        { raceId: 'NJ-9', label: 'Pou', party: 'D' },
        { raceId: 'NM-2', label: 'Vasquez', party: 'D' },
        { raceId: 'NV-3', label: 'Lee', party: 'D' },
        { raceId: 'NY-3', label: 'Suozzi', party: 'D' },
        { raceId: 'NY-4', label: 'Gillen', party: 'D' },
        { raceId: 'NY-19', label: 'Riley', party: 'D' },
        { raceId: 'OH-13', label: 'Sykes', party: 'D' },
        { raceId: 'TX-28', label: 'Cuellar', party: 'D' },
        { raceId: 'VA-7', label: 'Vindman', party: 'D' },
      ],
    },
    {
      rating: 'Toss Up',
      demSeats: 4,
      repSeats: 14,
      races: [
        { raceId: 'AZ-1', label: 'OPEN (Schweikert)', party: 'R' },
        { raceId: 'AZ-6', label: 'Ciscomani', party: 'R' },
        { raceId: 'CA-22', label: 'Valadao', party: 'R' },
        { raceId: 'CA-48', label: 'Issa', party: 'R' },
        { raceId: 'CO-8', label: 'Evans', party: 'R' },
        { raceId: 'IA-1', label: 'Miller-Meeks', party: 'R' },
        { raceId: 'IA-3', label: 'Nunn', party: 'R' },
        { raceId: 'MI-7', label: 'Barrett', party: 'R' },
        { raceId: 'NJ-7', label: 'Kean Jr.', party: 'R' },
        { raceId: 'NY-17', label: 'Lawler', party: 'R' },
        { raceId: 'OH-1', label: 'Landsman', party: 'D' },
        { raceId: 'OH-9', label: 'Kaptur', party: 'D' },
        { raceId: 'PA-7', label: 'Mackenzie', party: 'R' },
        { raceId: 'PA-10', label: 'Perry', party: 'R' },
        { raceId: 'TX-34', label: 'Gonzalez', party: 'D' },
        { raceId: 'VA-2', label: 'Kiggans', party: 'R' },
        { raceId: 'WA-3', label: 'Perez', party: 'D' },
        { raceId: 'WI-3', label: 'Van Orden', party: 'R' },
      ],
    },
    {
      rating: 'Lean R',
      demSeats: 1,
      repSeats: 3,
      races: [
        { raceId: 'MI-10', label: 'OPEN (James)', party: 'R' },
        { raceId: 'NC-1', label: 'Davis', party: 'D' },
        { raceId: 'PA-8', label: 'Bresnahan', party: 'R' },
        { raceId: 'VA-1', label: 'Wittman', party: 'R' },
      ],
    },
  ],
  senate: [
    {
      rating: 'Lean D',
      demSeats: 1,
      repSeats: 0,
      races: [{ raceId: 'NH-S', label: 'OPEN', party: 'D' }],
    },
    {
      rating: 'Toss Up',
      demSeats: 2,
      repSeats: 2,
      races: [
        { raceId: 'GA-S', label: 'Ossoff', party: 'D' },
        { raceId: 'ME-S', label: 'Collins', party: 'R' },
        { raceId: 'MI-S', label: 'OPEN', party: 'D' },
        { raceId: 'NC-S', label: 'OPEN', party: 'R' },
      ],
    },
    {
      rating: 'Lean R',
      demSeats: 0,
      repSeats: 2,
      races: [
        { raceId: 'AK-S', label: 'Sullivan', party: 'R' },
        { raceId: 'OH-S', label: 'Husted', party: 'R' },
      ],
    },
  ],
};

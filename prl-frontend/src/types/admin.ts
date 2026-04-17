// Admin panel types

// Survey Upload types
export type SurveyUploadType = 'labelled' | 'unlabelled' | 'international';

export interface SurveyConfig {
  apiKey: string;
  baseUrl: string;
}

export interface RecentSurveyUpload {
  id: string;
  filename: string;
  uploadType: SurveyUploadType;
  timestamp: string;
  status: 'success' | 'error';
  waveNumber?: number;
  year?: number;
  error?: string;
}

export interface SurveyValidationResult {
  isValid: boolean;
  uploadType?: SurveyUploadType;
  waveNumber?: number;
  year?: number;
  error?: string;
}

export const RESEARCHER_TAGS = ['Sean Westwood', 'Yphtach Lelkes', 'Shanto Iyengar', 'Lab'] as const;
export type ResearcherTag = (typeof RESEARCHER_TAGS)[number];

export interface MediaMention {
  id: string;
  publication: string;
  title: string;
  date: string; // YYYY-MM-DD
  url: string;
  tags?: ResearcherTag[];
}

export interface Report {
  slug: string;
  title: string;
  description: string;
  url: string;
  date: string;
  thumbnail: string | null;
  category: string;
  markdownFile: string;
  markdownContent?: string; // For editing
  contentType?: 'markdown' | 'html'; // defaults to 'markdown' if absent
  htmlFile?: string; // e.g. '/news/html/{slug}.html'
}

export interface ReportsData {
  lastUpdated: string;
  articles: Report[];
}

export type PrlMeta = 'Government Policy' | 'Politician/Party' | 'Unclear' | 'Institution';
export type Sex = 'Male' | 'Female' | 'Both' | '';

export interface PoliticalViolenceEvent {
  rowid: number;
  year: number;
  month: number;
  day: number;
  state: string;
  city: string;
  latitude: number;
  longitude: number;
  summary: string;
  attack_type: string;
  target: string;
  motive: string;
  num_perps: number;
  total_killed: number;
  perps_killed: number;
  prl_meta: PrlMeta;
  sex: Sex;
  trans: number;
  race: string;
}

export interface AdminState<T> {
  data: T;
  isDirty: boolean;
  lastSaved: string | null;
  lastLoaded: string | null;
}

// Team types
export interface TeamMember {
  name: string;
  title: string;
  institution: string;
  photo?: string;
  website?: string;
  profileLink?: string;
}

export interface TeamData {
  faculty: TeamMember[];
  staff: TeamMember[];
  postdocs: TeamMember[];
  gradStudents: TeamMember[];
  undergrads: string[];
  advisoryBoard: TeamMember[];
  globalAdvisors: TeamMember[];
}

// Profile types
export interface Publication {
  authors: string;
  year?: number | string;
  title: string;
  journal?: string;
  volume?: string;
  pages?: string;
  url?: string;
  note?: string;
  status?: 'R&R' | 'Under Review';
  citationKey?: string; // BibTeX citation key for matching during CV imports
  withStudent?: boolean; // Written with a student
  mediaCoverage?: string; // "Covered in: NYT, WaPo, etc."
}

export interface Chapter {
  authors: string;
  year: number;
  title: string;
  book: string;
  editors?: string;
  publisher: string;
  url?: string;
  citationKey?: string; // BibTeX citation key for matching during CV imports
}

export interface Award {
  name: string;
  year: number;
  institution: string;
}

export interface Grant {
  title: string;
  funder: string;
  role: string;
  amount: string;
  year: string;
}

export interface InvitedTalk {
  institution: string;
  year: number;
}

export interface ConferencePresentation {
  conference: string;
  year: number;
}

export interface ServiceItem {
  role: string;
  year: string;
}

export interface TeachingEvaluation {
  course: string;
  term: string;
  year: number;
  pdfUrl: string;
  courseQualityMean?: number;
  teachingEffectivenessMean?: number;
  positiveComments?: string[];
}

export interface ProfileBook {
  title: string;
  authors: string;
  year: number;
  publisher: string;
  url?: string;
  citationKey?: string; // BibTeX citation key for matching during CV imports
  reviewedIn?: string; // "Reviewed in: Journal of Politics, etc."
}

export interface Profile {
  name: string;
  title: string;
  institution: string;
  role: string;
  photo: string;
  email: string;
  googleScholar: string;
  googleCitations?: number;
  hIndex?: number;
  citationsLastUpdated?: string;
  cvUrl: string;
  bio: string[];
  researchInterests: string[];
}

export interface ProfileData {
  profile: Profile;
  books: ProfileBook[];
  publications: Publication[];
  otherFieldPublications: Publication[];
  underReview: Publication[];
  worksInProgress: Publication[];
  datasets: Publication[];
  technicalReports: Publication[];
  chapters: Chapter[];
  awards: Award[];
  grants: Grant[];
  invitedTalks: InvitedTalk[];
  conferencePresentations: ConferencePresentation[];
  service: ServiceItem[];
  teachingEvaluations?: TeachingEvaluation[];
}

export type BookingType = 'internal' | 'external' | 'none';

export interface Field {
  id: string;
  name: string;
  sport: string[];
  address: string;
  lat: number;
  lng: number;
  available: boolean;
  surface: string;
  isIndoor: boolean;
  isBookable: boolean;
  bookingType: BookingType;
  bookingUrl?: string;
  bookingEnabled: boolean;
  managerId?: string;
  phone?: string;
  website?: string;
}

export interface FieldsResponse {
  fields: Field[];
  total: number;
}

export type SportType =
  | 'piłka nożna'
  | 'koszykówka'
  | 'siatkówka'
  | 'siatkówka plażowa'
  | 'futsal'
  | 'piłka ręczna'
  | 'inne';

export interface FieldFilters {
  sport?: SportType;
  available?: boolean;
  bookable?: boolean;
  bookingType?: BookingType;
  managerId?: string;
  search?: string;
  lat?: number;
  lng?: number;
  radius_km?: number;
  limit?: number;
  offset?: number;
}

export interface VenueSchedule {
  id: string;
  fieldId: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  createdAt?: string;
}

export interface VenuePricing {
  id: string;
  fieldId: string;
  name: string;
  priceGrosze: number;
  dayOfWeek?: number[];
  timeFrom?: string;
  timeTo?: string;
  priority: number;
  createdAt?: string;
}

export interface Booking {
  id: string;
  fieldId: string;
  userId: string;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  priceGrosze: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  sport?: string;
  playersCount: number;
  phone?: string;
  notes?: string;
  createdAt: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  priceGrosze: number;
  available: boolean;
}

export type Visibility = 'private' | 'public';

export interface EventItem {
  id: string;
  organizerId: string;
  organizerName: string;
  sport: string;
  fieldId?: string;
  fieldName: string;
  lat?: number;
  lng?: number;
  title?: string;
  description?: string;
  date: string;
  time: string;
  endTime?: string;
  maxPlayers: number;
  visibility: Visibility;
  createdAt: string;
}

export interface EventParticipant {
  id: string;
  eventId: string;
  userId?: string;
  name: string;
  isGuest: boolean;
  hasPaid: boolean;
  isReserve: boolean;
  createdAt: string;
  avatarUrl?: string;
}

export interface EventCreate {
  sport: string;
  fieldId?: string;
  fieldName: string;
  lat?: number;
  lng?: number;
  title?: string;
  description?: string;
  date: string;
  time: string;
  endTime?: string;
  maxPlayers: number;
  visibility: Visibility;
}

export interface RecurringEvent {
  id: string;
  organizerId: string;
  organizerName: string;
  sport: string;
  fieldId?: string;
  fieldName: string;
  lat?: number;
  lng?: number;
  title?: string;
  description?: string;
  dayOfWeek: number; // 1=Mon … 7=Sun
  eventTime: string;
  endTime?: string;
  maxPlayers: number;
  visibility: Visibility;
  notifyDaysBefore: number;
  isActive: boolean;
  createdAt: string;
}

export interface RecurringEventInvite {
  id: string;
  recurringEventId: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt: string;
}

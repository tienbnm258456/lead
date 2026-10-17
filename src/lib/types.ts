import { LeadStatus } from '@prisma/client';

export interface Lead {
  id: number;
  fullname: string;
  phone: string;
  email: string | null;
  note: string | null;
  source: string;
  utm_source: string | null;
  utm_medium: string | null;
  status: LeadStatus;
  exported_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface LeadsResponse {
  data: Lead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LeadFilters {
  search?: string;
  status?: LeadStatus | '';
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

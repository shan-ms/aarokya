import { create } from 'zustand';
import {
  WorkerWithHsa,
  PartnerDashboard,
  Contribution,
  PaginatedResponse,
} from '../types';
import { listWorkers } from '../api/workers';
import { getDashboard } from '../api/partner';
import { getContributionHistory } from '../api/contributions';

interface PartnerState {
  workers: WorkerWithHsa[];
  workersTotal: number;
  workersPage: number;
  workersHasMore: boolean;
  workersLoading: boolean;
  workersError: string | null;

  dashboard: PartnerDashboard | null;
  dashboardLoading: boolean;
  dashboardError: string | null;

  contributions: Contribution[];
  contributionsTotal: number;
  contributionsLoading: boolean;
  contributionsError: string | null;

  fetchWorkers: (partnerId: string, params?: { page?: number; search?: string }) => Promise<void>;
  fetchMoreWorkers: (partnerId: string) => Promise<void>;
  fetchDashboard: (partnerId: string) => Promise<void>;
  fetchContributions: (
    partnerId: string,
    params?: { page?: number; workerId?: string; startDate?: string; endDate?: string },
  ) => Promise<void>;
  reset: () => void;
}

const PAGE_SIZE = 20;

export const usePartnerStore = create<PartnerState>((set, get) => ({
  workers: [],
  workersTotal: 0,
  workersPage: 1,
  workersHasMore: false,
  workersLoading: false,
  workersError: null,

  dashboard: null,
  dashboardLoading: false,
  dashboardError: null,

  contributions: [],
  contributionsTotal: 0,
  contributionsLoading: false,
  contributionsError: null,

  fetchWorkers: async (partnerId, params) => {
    set({ workersLoading: true, workersError: null });
    try {
      const response = await listWorkers(partnerId, {
        page: params?.page ?? 1,
        pageSize: PAGE_SIZE,
        search: params?.search,
      });
      const data: PaginatedResponse<WorkerWithHsa> = response.data;
      set({
        workers: data.items,
        workersTotal: data.total,
        workersPage: data.page,
        workersHasMore: data.hasMore,
        workersLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch workers';
      set({ workersError: message, workersLoading: false });
    }
  },

  fetchMoreWorkers: async (partnerId) => {
    const { workersHasMore, workersPage, workersLoading, workers } = get();
    if (!workersHasMore || workersLoading) return;

    set({ workersLoading: true });
    try {
      const response = await listWorkers(partnerId, {
        page: workersPage + 1,
        pageSize: PAGE_SIZE,
      });
      const data: PaginatedResponse<WorkerWithHsa> = response.data;
      set({
        workers: [...workers, ...data.items],
        workersTotal: data.total,
        workersPage: data.page,
        workersHasMore: data.hasMore,
        workersLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load more workers';
      set({ workersError: message, workersLoading: false });
    }
  },

  fetchDashboard: async (partnerId) => {
    set({ dashboardLoading: true, dashboardError: null });
    try {
      const response = await getDashboard(partnerId);
      set({ dashboard: response.data, dashboardLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch dashboard';
      set({ dashboardError: message, dashboardLoading: false });
    }
  },

  fetchContributions: async (partnerId, params) => {
    set({ contributionsLoading: true, contributionsError: null });
    try {
      const response = await getContributionHistory(partnerId, {
        page: params?.page ?? 1,
        pageSize: PAGE_SIZE,
        workerId: params?.workerId,
        startDate: params?.startDate,
        endDate: params?.endDate,
      });
      const data: PaginatedResponse<Contribution> = response.data;
      set({
        contributions: data.items,
        contributionsTotal: data.total,
        contributionsLoading: false,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch contributions';
      set({ contributionsError: message, contributionsLoading: false });
    }
  },

  reset: () => {
    set({
      workers: [],
      workersTotal: 0,
      workersPage: 1,
      workersHasMore: false,
      workersLoading: false,
      workersError: null,
      dashboard: null,
      dashboardLoading: false,
      dashboardError: null,
      contributions: [],
      contributionsTotal: 0,
      contributionsLoading: false,
      contributionsError: null,
    });
  },
}));

"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./useAuth";
import type { Incident, Service, PaginatedResponse } from "@/types";

interface DashboardStats {
  active_incidents: number;
  critical_count: number;
  major_count: number;
  services_degraded: number;
  services_total: number;
}

interface DashboardDataState {
  stats: DashboardStats | null;
  incidents: Incident[];
  services: Service[];
  loading: boolean;
  refresh: () => void;
}

const DashboardDataContext = createContext<DashboardDataState>({
  stats: null,
  incidents: [],
  services: [],
  loading: true,
  refresh: () => {},
});

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [statsRes, incidentsRes, servicesRes] = await Promise.allSettled([
        api.get<DashboardStats>("/dashboard"),
        api.get<PaginatedResponse<Incident>>("/incidents?per_page=50"),
        api.get<PaginatedResponse<Service>>("/services?per_page=100"),
      ]);
      if (!mountedRef.current) return;
      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (incidentsRes.status === "fulfilled") setIncidents(incidentsRes.value.data || []);
      if (servicesRes.status === "fulfilled") setServices(servicesRes.value.data || []);
    } catch {
      // silent
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => { mountedRef.current = false; };
  }, [fetchData]);

  return (
    <DashboardDataContext.Provider value={{ stats, incidents, services, loading, refresh: fetchData }}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  return useContext(DashboardDataContext);
}

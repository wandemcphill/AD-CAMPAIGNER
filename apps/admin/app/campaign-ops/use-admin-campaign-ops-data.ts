"use client";

import { useCallback, useEffect, useState } from "react";

import {
  emptyActivityState,
  emptyCampaignState,
  emptyOverviewState,
  emptyQueueState,
  emptyReportsState,
  loadAdminCampaignOpsActivity,
  loadAdminCampaignOpsCampaign,
  loadAdminCampaignOpsOverview,
  loadAdminCampaignOpsQueue,
  loadAdminCampaignOpsReports,
  subscribeToSessionChanges,
  type AdminCampaignOpsActivityState,
  type AdminCampaignOpsCampaignState,
  type AdminCampaignOpsOverviewState,
  type AdminCampaignOpsQueueState,
  type AdminCampaignOpsReportsState
} from "./api";

function messageFromError(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

export function useAdminCampaignOpsOverviewData() {
  const [state, setState] = useState<AdminCampaignOpsOverviewState>({
    ...emptyOverviewState,
    loading: true
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      setState(await loadAdminCampaignOpsOverview());
    } catch (caught) {
      setState({
        ...emptyOverviewState,
        error: messageFromError(caught, "Campaign ops overview API is unavailable."),
        loading: false
      });
    }
  }, []);

  useEffect(() => {
    void refresh();

    return subscribeToSessionChanges(() => {
      void refresh();
    });
  }, [refresh]);

  return { ...state, refresh };
}

export function useAdminCampaignOpsQueueData() {
  const [state, setState] = useState<AdminCampaignOpsQueueState>({
    ...emptyQueueState,
    loading: true
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      setState(await loadAdminCampaignOpsQueue());
    } catch (caught) {
      setState({
        ...emptyQueueState,
        error: messageFromError(caught, "Campaign ops queue API is unavailable."),
        loading: false
      });
    }
  }, []);

  useEffect(() => {
    void refresh();

    return subscribeToSessionChanges(() => {
      void refresh();
    });
  }, [refresh]);

  return { ...state, refresh };
}

export function useAdminCampaignOpsCampaign(campaignId: string) {
  const [state, setState] = useState<AdminCampaignOpsCampaignState>({
    ...emptyCampaignState,
    loading: true
  });

  const refresh = useCallback(async () => {
    if (!campaignId) {
      setState({
        ...emptyCampaignState,
        error: "Campaign id is missing.",
        loading: false
      });
      return;
    }

    setState((current) => ({ ...current, loading: true }));
    try {
      setState(await loadAdminCampaignOpsCampaign(campaignId));
    } catch (caught) {
      setState({
        ...emptyCampaignState,
        error: messageFromError(caught, "Campaign ops detail API is unavailable."),
        loading: false
      });
    }
  }, [campaignId]);

  useEffect(() => {
    void refresh();

    return subscribeToSessionChanges(() => {
      void refresh();
    });
  }, [refresh]);

  return { ...state, refresh };
}

export function useAdminCampaignOpsReportsData() {
  const [state, setState] = useState<AdminCampaignOpsReportsState>({
    ...emptyReportsState,
    loading: true
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      setState(await loadAdminCampaignOpsReports());
    } catch (caught) {
      setState({
        ...emptyReportsState,
        error: messageFromError(caught, "Campaign ops reports API is unavailable."),
        loading: false
      });
    }
  }, []);

  useEffect(() => {
    void refresh();

    return subscribeToSessionChanges(() => {
      void refresh();
    });
  }, [refresh]);

  return { ...state, refresh };
}

export function useAdminCampaignOpsActivityData() {
  const [state, setState] = useState<AdminCampaignOpsActivityState>({
    ...emptyActivityState,
    loading: true
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      setState(await loadAdminCampaignOpsActivity());
    } catch (caught) {
      setState({
        ...emptyActivityState,
        error: messageFromError(caught, "Campaign ops activity API is unavailable."),
        loading: false
      });
    }
  }, []);

  useEffect(() => {
    void refresh();

    return subscribeToSessionChanges(() => {
      void refresh();
    });
  }, [refresh]);

  return { ...state, refresh };
}

"use client";

import { useCallback, useEffect, useState } from "react";

import { isForbiddenError } from "../lib/api-client";
import {
  defaultBillingState,
  defaultCampaignBuilderState,
  defaultCampaignDashboardState,
  defaultOnboardingState,
  loadBillingData,
  loadCampaignBuilderData,
  loadCampaignDashboardData,
  loadOnboardingData,
  subscribeToSessionChanges,
  type BillingState,
  type CampaignBuilderState,
  type CampaignDashboardState,
  type OnboardingState
} from "./api";

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

export function useCampaignDashboardData() {
  const [state, setState] = useState<CampaignDashboardState>({
    ...defaultCampaignDashboardState,
    loading: true
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      setState(await loadCampaignDashboardData());
    } catch (caught) {
      setState({
        ...defaultCampaignDashboardState,
        error: errorMessage(caught, "Campaign APIs are unavailable."),
        forbidden: isForbiddenError(caught),
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

export function useCampaignBuilderData() {
  const [state, setState] = useState<CampaignBuilderState>({
    ...defaultCampaignBuilderState,
    loading: true
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      setState(await loadCampaignBuilderData());
    } catch (caught) {
      setState({
        ...defaultCampaignBuilderState,
        error: errorMessage(caught, "Destination catalog is unavailable."),
        forbidden: isForbiddenError(caught),
        loading: false
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}

export function useBillingData() {
  const [state, setState] = useState<BillingState>({
    ...defaultBillingState,
    loading: true
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      setState(await loadBillingData());
    } catch (caught) {
      setState({
        ...defaultBillingState,
        error: errorMessage(caught, "Billing APIs are unavailable."),
        forbidden: isForbiddenError(caught),
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

export function useOnboardingData() {
  const [state, setState] = useState<OnboardingState>({
    ...defaultOnboardingState,
    loading: true
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      setState(await loadOnboardingData());
    } catch (caught) {
      setState({
        ...defaultOnboardingState,
        error: errorMessage(caught, "Onboarding APIs are unavailable."),
        forbidden: isForbiddenError(caught),
        loading: false
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}

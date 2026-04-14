import { useQuery, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import type { UseQueryOptions, UseSuspenseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
export class ApiError extends Error {
    status: number;
    statusText: string;
    body: unknown;
    constructor(status: number, statusText: string, body: unknown){
        super(`HTTP ${status}: ${statusText}`);
        this.name = "ApiError";
        this.status = status;
        this.statusText = statusText;
        this.body = body;
    }
}
export interface ChatRequest {
    conversation_id?: string | null;
    message: string;
}
export interface ComplexValue {
    display?: string | null;
    primary?: boolean | null;
    ref?: string | null;
    type?: string | null;
    value?: string | null;
}
export interface DealScenarioIn {
    city?: string | null;
    exit_cap_rate_pct?: number;
    expense_ratio_pct?: number;
    hold_years?: number;
    interest_rate_pct?: number;
    loan_term_years?: number;
    ltv_pct?: number;
    monthly_rent_per_unit: number;
    property_name: string;
    property_type?: string | null;
    purchase_price: number;
    rent_growth_pct?: number;
    state?: string | null;
    units?: number;
}
export interface DealScenarioOut {
    cash_on_cash_pct?: number | null;
    city?: string | null;
    created_at?: string | null;
    deal_id: string;
    dscr?: number | null;
    equity_multiple?: number | null;
    exit_cap_rate_pct: number;
    expense_ratio_pct: number;
    hold_years: number;
    interest_rate_pct: number;
    irr_pct?: number | null;
    loan_term_years: number;
    ltv_pct: number;
    monthly_rent_per_unit: number;
    noi?: number | null;
    npv?: number | null;
    property_name: string;
    property_type?: string | null;
    purchase_price: number;
    rent_growth_pct: number;
    state?: string | null;
    units: number;
    updated_at?: string | null;
}
export interface HTTPValidationError {
    detail?: ValidationError[];
}
export interface Name {
    family_name?: string | null;
    given_name?: string | null;
}
export interface PortfolioMetricOut {
    acquisition_date: string;
    address: string;
    annualized_gross_rent?: number | null;
    asset_class: string;
    avg_monthly_rent?: number | null;
    avg_rent_collected?: number | null;
    cash_yield_pct?: number | null;
    city: string;
    collection_rate_pct?: number | null;
    current_appraised_value: number;
    image_url?: string | null;
    latest_rent_date?: string | null;
    market_id: string;
    occupancy_rate_pct?: number | null;
    property_id: string;
    property_name: string;
    property_type: string;
    purchase_price: number;
    square_footage: number;
    state: string;
    total_unit_months?: number | null;
    units: number;
    unrealized_gain?: number | null;
    year_built: number;
    zip_code: string;
}
export interface PortfolioOverviewOut {
    avg_cash_yield_pct?: number | null;
    avg_occupancy_pct?: number | null;
    properties: PortfolioMetricOut[];
    total_annualized_rent?: number | null;
    total_aum: number;
    total_properties: number;
    total_units: number;
}
export interface PortfolioTimeSeriesOut {
    active_properties: number;
    annualized_cash_yield_pct?: number | null;
    denver_occupancy_pct?: number | null;
    denver_properties?: number | null;
    effective_rent_collected: number;
    gross_potential_rent: number;
    occupied_units: number;
    other_occupancy_pct?: number | null;
    portfolio_collection_rate_pct?: number | null;
    portfolio_occupancy_pct?: number | null;
    rent_month: string;
    total_aum: number;
    total_cost_basis: number;
    total_units: number;
}
export interface User {
    active?: boolean | null;
    display_name?: string | null;
    emails?: ComplexValue[] | null;
    entitlements?: ComplexValue[] | null;
    external_id?: string | null;
    groups?: ComplexValue[] | null;
    id?: string | null;
    name?: Name | null;
    roles?: ComplexValue[] | null;
    schemas?: UserSchema[] | null;
    user_name?: string | null;
}
export const UserSchema = {
    "urn:ietf:params:scim:schemas:core:2.0:User": "urn:ietf:params:scim:schemas:core:2.0:User",
    "urn:ietf:params:scim:schemas:extension:workspace:2.0:User": "urn:ietf:params:scim:schemas:extension:workspace:2.0:User"
} as const;
export type UserSchema = typeof UserSchema[keyof typeof UserSchema];
export interface ValidationError {
    ctx?: Record<string, unknown>;
    input?: unknown;
    loc: (string | number)[];
    msg: string;
    type: string;
}
export interface VersionOut {
    version: string;
}
export interface ChatParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const chat = async (data: ChatRequest, params?: ChatParams, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch("/api/chat", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useChat(options?: {
    mutation?: UseMutationOptions<{
        data: unknown;
    }, ApiError, {
        params: ChatParams;
        data: ChatRequest;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>chat(vars.data, vars.params),
        ...options?.mutation
    });
}
export interface CurrentUserParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const currentUser = async (params?: CurrentUserParams, options?: RequestInit): Promise<{
    data: User;
}> =>{
    const res = await fetch("/api/current-user", {
        ...options,
        method: "GET",
        headers: {
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        }
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const currentUserKey = (params?: CurrentUserParams)=>{
    return [
        "/api/current-user",
        params
    ] as const;
};
export function useCurrentUser<TData = {
    data: User;
}>(options?: {
    params?: CurrentUserParams;
    query?: Omit<UseQueryOptions<{
        data: User;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: currentUserKey(options?.params),
        queryFn: ()=>currentUser(options?.params),
        ...options?.query
    });
}
export function useCurrentUserSuspense<TData = {
    data: User;
}>(options?: {
    params?: CurrentUserParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: User;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: currentUserKey(options?.params),
        queryFn: ()=>currentUser(options?.params),
        ...options?.query
    });
}
export const listDealScenarios = async (options?: RequestInit): Promise<{
    data: DealScenarioOut[];
}> =>{
    const res = await fetch("/api/deals", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const listDealScenariosKey = ()=>{
    return [
        "/api/deals"
    ] as const;
};
export function useListDealScenarios<TData = {
    data: DealScenarioOut[];
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: DealScenarioOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: listDealScenariosKey(),
        queryFn: ()=>listDealScenarios(),
        ...options?.query
    });
}
export function useListDealScenariosSuspense<TData = {
    data: DealScenarioOut[];
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: DealScenarioOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: listDealScenariosKey(),
        queryFn: ()=>listDealScenarios(),
        ...options?.query
    });
}
export const createDealForecast = async (data: DealScenarioIn, options?: RequestInit): Promise<{
    data: DealScenarioOut;
}> =>{
    const res = await fetch("/api/deals", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useCreateDealForecast(options?: {
    mutation?: UseMutationOptions<{
        data: DealScenarioOut;
    }, ApiError, DealScenarioIn>;
}) {
    return useMutation({
        mutationFn: (data)=>createDealForecast(data),
        ...options?.mutation
    });
}
export interface GetDealScenarioParams {
    deal_id: string;
}
export const getDealScenario = async (params: GetDealScenarioParams, options?: RequestInit): Promise<{
    data: DealScenarioOut;
}> =>{
    const res = await fetch(`/api/deals/${params.deal_id}`, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getDealScenarioKey = (params?: GetDealScenarioParams)=>{
    return [
        "/api/deals/{deal_id}",
        params
    ] as const;
};
export function useGetDealScenario<TData = {
    data: DealScenarioOut;
}>(options: {
    params: GetDealScenarioParams;
    query?: Omit<UseQueryOptions<{
        data: DealScenarioOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getDealScenarioKey(options.params),
        queryFn: ()=>getDealScenario(options.params),
        ...options?.query
    });
}
export function useGetDealScenarioSuspense<TData = {
    data: DealScenarioOut;
}>(options: {
    params: GetDealScenarioParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: DealScenarioOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getDealScenarioKey(options.params),
        queryFn: ()=>getDealScenario(options.params),
        ...options?.query
    });
}
export const getPortfolioOverview = async (options?: RequestInit): Promise<{
    data: PortfolioOverviewOut;
}> =>{
    const res = await fetch("/api/portfolio/overview", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getPortfolioOverviewKey = ()=>{
    return [
        "/api/portfolio/overview"
    ] as const;
};
export function useGetPortfolioOverview<TData = {
    data: PortfolioOverviewOut;
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: PortfolioOverviewOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getPortfolioOverviewKey(),
        queryFn: ()=>getPortfolioOverview(),
        ...options?.query
    });
}
export function useGetPortfolioOverviewSuspense<TData = {
    data: PortfolioOverviewOut;
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: PortfolioOverviewOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getPortfolioOverviewKey(),
        queryFn: ()=>getPortfolioOverview(),
        ...options?.query
    });
}
export const getPortfolioTimeSeries = async (options?: RequestInit): Promise<{
    data: PortfolioTimeSeriesOut[];
}> =>{
    const res = await fetch("/api/portfolio/time-series", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getPortfolioTimeSeriesKey = ()=>{
    return [
        "/api/portfolio/time-series"
    ] as const;
};
export function useGetPortfolioTimeSeries<TData = {
    data: PortfolioTimeSeriesOut[];
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: PortfolioTimeSeriesOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getPortfolioTimeSeriesKey(),
        queryFn: ()=>getPortfolioTimeSeries(),
        ...options?.query
    });
}
export function useGetPortfolioTimeSeriesSuspense<TData = {
    data: PortfolioTimeSeriesOut[];
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: PortfolioTimeSeriesOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getPortfolioTimeSeriesKey(),
        queryFn: ()=>getPortfolioTimeSeries(),
        ...options?.query
    });
}
export interface GetPropertyParams {
    property_id: string;
}
export const getProperty = async (params: GetPropertyParams, options?: RequestInit): Promise<{
    data: PortfolioMetricOut;
}> =>{
    const res = await fetch(`/api/properties/${params.property_id}`, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getPropertyKey = (params?: GetPropertyParams)=>{
    return [
        "/api/properties/{property_id}",
        params
    ] as const;
};
export function useGetProperty<TData = {
    data: PortfolioMetricOut;
}>(options: {
    params: GetPropertyParams;
    query?: Omit<UseQueryOptions<{
        data: PortfolioMetricOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getPropertyKey(options.params),
        queryFn: ()=>getProperty(options.params),
        ...options?.query
    });
}
export function useGetPropertySuspense<TData = {
    data: PortfolioMetricOut;
}>(options: {
    params: GetPropertyParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: PortfolioMetricOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getPropertyKey(options.params),
        queryFn: ()=>getProperty(options.params),
        ...options?.query
    });
}
export const version = async (options?: RequestInit): Promise<{
    data: VersionOut;
}> =>{
    const res = await fetch("/api/version", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const versionKey = ()=>{
    return [
        "/api/version"
    ] as const;
};
export function useVersion<TData = {
    data: VersionOut;
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: VersionOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: versionKey(),
        queryFn: ()=>version(),
        ...options?.query
    });
}
export function useVersionSuspense<TData = {
    data: VersionOut;
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: VersionOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: versionKey(),
        queryFn: ()=>version(),
        ...options?.query
    });
}

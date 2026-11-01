import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AdminDashboard, AdminHome, AdminManagement } from "../src/features/AdminDashboard";
import { useAuth } from "../src/stores/auth";
vi.mock("../src/services/api",()=>({api:vi.fn()}));
import { api } from "../src/services/api";
afterEach(()=>{cleanup();vi.resetAllMocks();useAuth.getState().clear();});
function auth(role="admin",superuser=false){useAuth.getState().set("test",{id:1,username:"Administrator",email:"",role,can_edit:role!=="student",can_view_users:role==="admin",is_superuser:superuser});}
function show(element=<AdminDashboard/>){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>);}
it("shows real overview and separate destinations for a super administrator",async()=>{
 auth("admin",true);vi.mocked(api).mockResolvedValue({total_users:12,learning_users_7d:3,completed_mocks:7,checked_answers:80});show();
 expect(await screen.findByText("12")).toBeTruthy();
 expect(screen.getByRole("link",{name:/Content library/})).toHaveAttribute("href","/admin/content");
 expect(screen.getByRole("link",{name:/Administrators & activity/})).toHaveAttribute("href","/admin/management");
 expect(screen.queryByRole("list",{name:"Content workflow"})).toBeNull();
});
it("keeps teacher dashboard focused on content and own profile",()=>{
 auth("teacher");show();expect(screen.getByRole("link",{name:/Content library/})).toBeTruthy();
 expect(screen.queryByRole("link",{name:/Users & statistics/})).toBeNull();expect(api).not.toHaveBeenCalled();
});
it("rejects ordinary administrator access to management without fetching its data",()=>{
 auth();show(<AdminManagement/>);expect(screen.getByText("Super administrator only")).toBeTruthy();expect(api).not.toHaveBeenCalled();
});
it("keeps old category and test URLs working through content redirect",async()=>{
 const Target=()=>{const location=useLocation();return <p>{location.pathname+location.search}</p>;};
 render(<MemoryRouter initialEntries={["/admin?category=12&test=3"]}><Routes><Route path="/admin" element={<AdminHome/>}/><Route path="/admin/content" element={<Target/>}/></Routes></MemoryRouter>);
 expect(await screen.findByText("/admin/content?category=12&test=3")).toBeTruthy();
});

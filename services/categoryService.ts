import { supabase } from "@/lib/supabase";
import { normaliseError } from "@/lib/offline";
import type { Category } from "@/types";

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []) as Category[];
}

export async function getAllCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []) as Category[];
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as Category | null;
}

export interface CreateCategoryResult {
  success: boolean;
  message: string;
  category?: Category;
}

export async function createCategory(name: string): Promise<CreateCategoryResult> {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { success: false, message: "Category name is required" };
  }

  if (trimmedName.length < 2) {
    return { success: false, message: "Category name must be at least 2 characters" };
  }

  if (trimmedName.length > 100) {
    return { success: false, message: "Category name cannot exceed 100 characters" };
  }

  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .ilike("name", trimmedName)
    .maybeSingle();

  if (existing) {
    return { success: false, message: "A category with this name already exists" };
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({ name: trimmedName, is_active: true })
    .select()
    .single();

  if (error) {
    return { success: false, message: normaliseError(error) };
  }

  return { success: true, message: "Category created successfully", category: data };
}

export async function updateCategory(
  id: string,
  updates: { name?: string; is_active?: boolean }
): Promise<CreateCategoryResult> {
  const updateData: { name?: string; is_active?: boolean } = {};

  if (updates.name !== undefined) {
    const trimmedName = updates.name.trim();
    if (!trimmedName) {
      return { success: false, message: "Category name is required" };
    }
    if (trimmedName.length < 2) {
      return { success: false, message: "Category name must be at least 2 characters" };
    }
    if (trimmedName.length > 100) {
      return { success: false, message: "Category name cannot exceed 100 characters" };
    }

    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .ilike("name", trimmedName)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      return { success: false, message: "A category with this name already exists" };
    }

    updateData.name = trimmedName;
  }

  if (updates.is_active !== undefined) {
    updateData.is_active = updates.is_active;
  }

  const { data, error } = await supabase
    .from("categories")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { success: false, message: normaliseError(error) };
  }

  return { success: true, message: "Category updated successfully", category: data };
}

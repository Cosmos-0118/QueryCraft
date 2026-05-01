import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  inferFunctionalDependencies,
  inferPrimaryKey,
  normalize,
} from '@/lib/engine/normalizer-engine';
import { STORAGE_BASE_KEYS, userScopedStateStorage } from '@/lib/utils/user-storage';
import type {
  Column,
  NormalForm,
  NormalizationResult,
  TableSchema,
} from '@/types/normalizer';

export const NORMALIZER_PRESET_NAMES = ['university', 'banking', 'credentia'] as const;

export type NormalizerPreset = (typeof NORMALIZER_PRESET_NAMES)[number];

interface NormalizerState {
  inputTable: TableSchema | null;
  result: NormalizationResult | null;
  currentStepIndex: number;
  selectedNodeId: string | null;
  showSampleData: boolean;
  showFDs: boolean;
  showAnomalies: boolean;
  setInputTable: (table: TableSchema) => void;
  runNormalization: (targetNF: NormalForm) => void;
  setStep: (index: number) => void;
  selectNode: (id: string | null) => void;
  toggleSampleData: () => void;
  toggleFDs: () => void;
  toggleAnomalies: () => void;
  loadPreset: (name: string) => void;
  clear: () => void;
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((item) => stringifyCell(item)).join('|');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function inferColumnType(values: string[]): string {
  const nonEmpty = values.filter((value) => value.trim().length > 0);
  if (nonEmpty.length === 0) return 'text';
  if (nonEmpty.every((value) => /^-?\d+(\.\d+)?$/.test(value))) return 'number';
  if (nonEmpty.every((value) => !Number.isNaN(Date.parse(value)))) return 'date';
  return 'text';
}

export function buildNormalizerTableFromRecords(name: string, rows: Record<string, unknown>[]): TableSchema {
  const columns = Array.from(
    rows.reduce((set, row) => {
      for (const key of Object.keys(row)) set.add(key);
      return set;
    }, new Set<string>()),
  );

  const sampleData = rows.map((row) => columns.map((column) => stringifyCell(row[column])));
  const inferredFds = inferFunctionalDependencies(columns, sampleData);
  const primaryKey = inferPrimaryKey(columns, sampleData, inferredFds);

  const normalizedColumns: Column[] = columns.map((columnName, index) => ({
    name: columnName,
    type: inferColumnType(sampleData.map((row) => row[index] ?? '')),
    isKey: primaryKey.includes(columnName),
  }));

  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    name,
    columns: normalizedColumns,
    primaryKey,
    foreignKeys: [],
    fds: inferredFds,
    mvds: [],
    sampleData,
  };
}

export function getNormalizerPresetTable(preset: NormalizerPreset): TableSchema {
  if (preset === 'university') {
    return buildNormalizerTableFromRecords('UniversityEnrollment', [
      {
        student_id: 'S101',
        student_name: 'Alice Johnson',
        department_id: 'D01',
        department_name: 'Computer Science',
        course_id: 'C101',
        course_title: 'Database Systems',
        skills: ['SQL', 'Python'],
      },
      {
        student_id: 'S101',
        student_name: 'Alice Johnson',
        department_id: 'D01',
        department_name: 'Computer Science',
        course_id: 'C102',
        course_title: 'Algorithms',
        skills: ['SQL', 'Python'],
      },
      {
        student_id: 'S102',
        student_name: 'Bob Smith',
        department_id: 'D02',
        department_name: 'Mathematics',
        course_id: 'C201',
        course_title: 'Linear Algebra',
        skills: ['R', 'Statistics'],
      },
    ]);
  }

  if (preset === 'banking') {
    return buildNormalizerTableFromRecords('BankingLedger', [
      {
        account_id: 'A1001',
        customer_id: 'CU01',
        customer_name: 'John Doe',
        branch_id: 'B01',
        branch_city: 'Metro City',
        loan_id: 'L90',
        loan_rate: 7.5,
      },
      {
        account_id: 'A1002',
        customer_id: 'CU01',
        customer_name: 'John Doe',
        branch_id: 'B01',
        branch_city: 'Metro City',
        loan_id: 'L91',
        loan_rate: 7.5,
      },
      {
        account_id: 'A1003',
        customer_id: 'CU02',
        customer_name: 'Jane Roe',
        branch_id: 'B02',
        branch_city: 'Green Town',
        loan_id: 'L92',
        loan_rate: 8,
      },
    ]);
  }

  return buildNormalizerTableFromRecords('CredentiaClassRoster', [
    {
      class_id: 'CLS-101',
      class_name: 'Intro to Algorithms',
      faculty_id: 'F-10',
      faculty_name: 'Dr. Henry Jones',
      student_id: 'S-1',
      student_name: 'Alice Wong',
      student_languages: ['English', 'Mandarin'],
    },
    {
      class_id: 'CLS-101',
      class_name: 'Intro to Algorithms',
      faculty_id: 'F-10',
      faculty_name: 'Dr. Henry Jones',
      student_id: 'S-2',
      student_name: 'Bob Kumar',
      student_languages: ['English', 'Hindi'],
    },
    {
      class_id: 'CLS-220',
      class_name: 'Data Modeling',
      faculty_id: 'F-11',
      faculty_name: 'Dr. Neha Patel',
      student_id: 'S-1',
      student_name: 'Alice Wong',
      student_languages: ['English', 'Mandarin'],
    },
  ]);
}

function asPreset(name: string): NormalizerPreset {
  const lowered = name.toLowerCase().trim();
  if ((NORMALIZER_PRESET_NAMES as readonly string[]).includes(lowered)) {
    return lowered as NormalizerPreset;
  }
  return 'university';
}

export const useNormalizerStore = create<NormalizerState>()(
  persist(
    (set, get) => ({
      inputTable: null,
      result: null,
      currentStepIndex: 0,
      selectedNodeId: null,
      showSampleData: true,
      showFDs: true,
      showAnomalies: true,

      setInputTable: (table) => {
        set({
          inputTable: table,
          result: null,
          currentStepIndex: 0,
          selectedNodeId: null,
        });
      },

      runNormalization: (targetNF) => {
        const inputTable = get().inputTable;
        if (!inputTable) return;

        const result = normalize(inputTable, targetNF);
        const maxIndex = Math.max(0, result.steps.length - 1);

        set((state) => ({
          result,
          currentStepIndex: Math.max(0, Math.min(state.currentStepIndex, maxIndex)),
        }));
      },

      setStep: (index) => {
        const steps = get().result?.steps ?? [];
        const maxIndex = Math.max(0, steps.length - 1);
        set({ currentStepIndex: Math.max(0, Math.min(index, maxIndex)) });
      },

      selectNode: (selectedNodeId) => {
        set({ selectedNodeId });
      },

      toggleSampleData: () => {
        set((state) => ({ showSampleData: !state.showSampleData }));
      },

      toggleFDs: () => {
        set((state) => ({ showFDs: !state.showFDs }));
      },

      toggleAnomalies: () => {
        set((state) => ({ showAnomalies: !state.showAnomalies }));
      },

      loadPreset: (name) => {
        const preset = asPreset(name);
        const table = getNormalizerPresetTable(preset);
        set({
          inputTable: table,
          result: null,
          currentStepIndex: 0,
          selectedNodeId: null,
        });
      },

      clear: () => {
        set({
          inputTable: null,
          result: null,
          currentStepIndex: 0,
          selectedNodeId: null,
          showSampleData: true,
          showFDs: true,
          showAnomalies: true,
        });
      },
    }),
    {
      name: STORAGE_BASE_KEYS.normalizer,
      storage: createJSONStorage(() => userScopedStateStorage),
      partialize: (state) => ({
        inputTable: state.inputTable,
        currentStepIndex: state.currentStepIndex,
        showSampleData: state.showSampleData,
        showFDs: state.showFDs,
        showAnomalies: state.showAnomalies,
      }),
    },
  ),
);

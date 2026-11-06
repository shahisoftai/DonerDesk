"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { localPlainDay } from "../domain/record-day";
import { useNetworkServices, useRecordValueSink } from "../composition";
import { ValueForm, type ValueFormProps } from "./ValueForm";

/**
 * The number form as a page (`/enter`): the page's data comes from the server, the save goes through the same sink as the Record
 * sheet. Refreshing after a manager opens a period reloads the server data; Done goes back to the project.
 */
export function ValueFormHost(props: Omit<ValueFormProps, "sink" | "periodOpener" | "onPeriodsChanged" | "onDone" | "today">) {
  const router = useRouter();
  const sink = useRecordValueSink();
  const { periods } = useNetworkServices();
  const today = useMemo(() => localPlainDay(new Date()), []);
  return <ValueForm {...props} today={today} sink={sink} periodOpener={periods} onPeriodsChanged={() => router.refresh()} onDone={() => router.push(`/projects/${props.projectId}`)} />;
}

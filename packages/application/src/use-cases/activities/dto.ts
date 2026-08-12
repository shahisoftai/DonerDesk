import type { ActivityUpdate } from "@donordesk/domain";

export interface ActivityUpdateDto {
  id: string;
  reportingPeriodId: string;
  projectId: string;
  activityTitle: string;
  activityDate: string;
  location?: string;
  outputId?: string;
  indicatorId?: string;
  participantsTotal?: number;
  participantsMale?: number;
  participantsFemale?: number;
  participantsChildren?: number;
  participantsDisability?: number;
  participantsOther?: string;
  summary: string;
  achievements: string;
  challenges: string;
  lessonsLearned: string;
  nextSteps: string;
  polishedNarrative?: string;
  attachedEvidenceIds: string[];
  status: string;
  submittedById: string;
  createdAt?: string;
}

export function toActivityUpdateDto(a: ActivityUpdate): ActivityUpdateDto {
  return {
    id: a.id,
    reportingPeriodId: a.reportingPeriodId,
    projectId: a.projectId,
    activityTitle: a.activityTitle,
    activityDate: a.activityDate.toISOString(),
    location: a.location,
    outputId: a.outputId,
    indicatorId: a.indicatorId,
    participantsTotal: a.participantsTotal,
    participantsMale: a.participantsMale,
    participantsFemale: a.participantsFemale,
    participantsChildren: a.participantsChildren,
    participantsDisability: a.participantsDisability,
    participantsOther: a.participantsOther,
    summary: a.summary,
    achievements: a.achievements,
    challenges: a.challenges,
    lessonsLearned: a.lessonsLearned,
    nextSteps: a.nextSteps,
    polishedNarrative: a.polishedNarrative,
    attachedEvidenceIds: a.attachedEvidenceIds,
    status: a.status,
    submittedById: a.submittedById,
    createdAt: a.createdAt?.toISOString(),
  };
}

{{/*
Expand the name of the chart
*/}}
{{- define "donordesk-api.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name
*/}}
{{- define "donordesk-api.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create the service account name
*/}}
{{- define "donordesk-api.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- include "donordesk-api.fullname" . }}
{{- else }}
{{- .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create chart name and version
*/}}
{{- define "donordesk-api.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "donordesk-api.labels" -}}
app.kubernetes.io/name: {{ include "donordesk-api.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: donordesk
app.kubernetes.io/component: api
helm.sh/chart: {{ include "donordesk-api.chart" . }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "donordesk-api.selectorLabels" -}}
app.kubernetes.io/name: {{ include "donordesk-api.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
AWS Region label for multi-region
*/}}
{{- define "donordesk-api.region" -}}
{{- .Values.multiRegion.primaryRegion | default "us-east-1" }}
{{- end }}

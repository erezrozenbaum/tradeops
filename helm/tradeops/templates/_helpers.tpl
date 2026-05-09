{{/*
Expand the name of the chart.
*/}}
{{- define "tradeops.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "tradeops.fullname" -}}
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
Create chart label.
*/}}
{{- define "tradeops.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "tradeops.labels" -}}
helm.sh/chart: {{ include "tradeops.chart" . }}
{{ include "tradeops.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "tradeops.selectorLabels" -}}
app.kubernetes.io/name: {{ include "tradeops.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Service account name.
*/}}
{{- define "tradeops.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "tradeops.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Database URL — auto-composed when postgresql.enabled=true, otherwise taken from secret.databaseUrl.
*/}}
{{- define "tradeops.databaseUrl" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "postgresql://%s:%s@%s-postgres:%d/%s" .Values.postgresql.user .Values.secret.postgresPassword (include "tradeops.fullname" .) (int .Values.postgresql.port) .Values.postgresql.database }}
{{- else }}
{{- .Values.secret.databaseUrl }}
{{- end }}
{{- end }}

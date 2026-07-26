"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Trash2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { apiErrorMessage } from "@/lib/utils";

interface AttachmentRow {
  id: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes: number;
  storageKey?: string | null;
  createdAt: string;
}

interface EntityAttachmentsProps {
  entityType: string;
  entityId: string;
  className?: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export function EntityAttachments({ entityType, entityId, className }: EntityAttachmentsProps) {
  const t = useTranslations("attachments");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const queryKey = ["attachments", entityType, entityId];

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () =>
      (await api.getAttachments(entityType, entityId)).data as AttachmentRow[],
    enabled: !!entityId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 2_000_000) {
        throw new Error(t("tooLarge"));
      }
      const storageKey = await readFileAsDataUrl(file);
      return api.createAttachment({
        entityType,
        entityId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        storageKey,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(tCommon("saved"));
    },
    onError: (err: { message?: string; response?: { data?: { message?: string } } }) => {
      toast.error(apiErrorMessage(err, tCommon("error")));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAttachment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(tCommon("deleted"));
    },
    onError: () => toast.error(tCommon("error")),
  });

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm text-slate-400 flex items-center gap-1.5">
          <Paperclip className="w-4 h-4" />
          {t("title")}
        </p>
        <button
          type="button"
          disabled={uploadMutation.isPending || !entityId}
          onClick={() => inputRef.current?.click()}
          className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          {uploadMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            t("add")
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) uploadMutation.mutate(file);
          }}
        />
      </div>
      {isLoading ? (
        <p className="text-xs text-slate-500">{tCommon("loading")}</p>
      ) : isError ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-rose-400">{tCommon("error")}</span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-emerald-400 hover:underline"
          >
            {tCommon("retry")}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-500">{t("empty")}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 text-sm text-slate-300 bg-slate-800/50 rounded-lg px-2 py-1.5"
            >
              <span className="truncate" title={row.fileName}>
                {row.storageKey ? (
                  <a
                    href={row.storageKey}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-300 hover:text-sky-200"
                  >
                    {row.fileName}
                  </a>
                ) : (
                  row.fileName
                )}
              </span>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(row.id)}
                className="p-1 text-rose-400 hover:bg-rose-500/10 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

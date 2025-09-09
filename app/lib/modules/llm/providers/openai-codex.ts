import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class OpenAICodexProvider extends BaseProvider {
  name = 'OpenAI Codex';

  config = {
    baseUrlKey: 'OPENAI_CODEX_API_BASE_URL',
  };

  staticModels: ModelInfo[] = [
    { name: 'code-davinci-002', label: 'Code-Davinci-002', provider: 'OpenAI Codex', maxTokenAllowed: 8000 },
    { name: 'code-cushman-001', label: 'Code-Cushman-001', provider: 'OpenAI Codex', maxTokenAllowed: 8000 },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    let { baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'OPENAI_CODEX_API_BASE_URL',
      defaultApiTokenKey: '',
    });

    if (!baseUrl) {
      throw new Error('No baseUrl found for OpenAI Codex provider');
    }

    const response = await fetch(`${baseUrl}/v1/models`);
    const data = (await response.json()) as { data: Array<{ id: string; context_window?: number }> };

    return data.data.map((model) => ({
      name: model.id,
      label: model.id,
      provider: this.name,
      maxTokenAllowed: model.context_window || 8000,
    }));
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    let { baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'OPENAI_CODEX_API_BASE_URL',
      defaultApiTokenKey: '',
    });

    if (!baseUrl) {
      throw new Error('No baseUrl found for OpenAI Codex provider');
    }

    const openai = createOpenAI({
      baseURL: `${baseUrl}/v1`,
      apiKey: '',
    });

    return openai(model);
  }
}


import { TextDocument } from 'vscode';
import { VariableType } from "../models/variableType";
import { EnvironmentVariableProvider } from './httpVariableProviders/environmentVariableProvider';
import { FileVariableProvider } from './httpVariableProviders/fileVariableProvider';
import { HttpVariableProvider } from './httpVariableProviders/httpVariableProvider';
import { RequestVariableProvider } from './httpVariableProviders/requestVariableProvider';
import { SystemVariableProvider } from './httpVariableProviders/systemVariableProvider';
import { getCurrentTextDocument } from './workspaceUtility';

export class VariableProcessor {

    private static readonly providers: [HttpVariableProvider, boolean][] = [
        [SystemVariableProvider.Instance, false],
        [RequestVariableProvider.Instance, true],
        [FileVariableProvider.Instance, true],
        [EnvironmentVariableProvider.Instance, true],
    ];

    public static async processRawRequest(request: string, resolvedVariables: Map<string, string> = new Map<string, string>()) {
        const variableReferenceRegex = /\{{2}(.+?)\}{2}/g;
        let result = '';
        let match: RegExpExecArray | null;
        let lastIndex = 0;
        variable:
        while (match = variableReferenceRegex.exec(request)) {
            result += request.substring(lastIndex, match.index);
            lastIndex = variableReferenceRegex.lastIndex;
            const name = match[1].trim();
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/2e406a9d-7ba3-4be3-8cb4-9dfba6495911',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'variableProcessor.ts:28',message:'Variable detected',data:{varName:name,isFaker:name.startsWith('$faker')},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            const document = getCurrentTextDocument();
            const context = { rawRequest: request, parsedRequest: result };
            for (const [provider, cacheable] of this.providers) {
                if (resolvedVariables.has(name)) {
                    result += resolvedVariables.get(name);
                    continue variable;
                }
                // #region agent log
                const providerType = provider.type;
                fetch('http://127.0.0.1:7242/ingest/2e406a9d-7ba3-4be3-8cb4-9dfba6495911',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'variableProcessor.ts:36',message:'Checking provider',data:{varName:name,providerType:providerType},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                if (await provider.has(name, document, context)) {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/2e406a9d-7ba3-4be3-8cb4-9dfba6495911',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'variableProcessor.ts:40',message:'Provider has variable',data:{varName:name,providerType:providerType},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
                    // #endregion
                    const { value, error, warning } = await provider.get(name, document, context);
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/2e406a9d-7ba3-4be3-8cb4-9dfba6495911',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'variableProcessor.ts:44',message:'Provider returned',data:{varName:name,value:value,error:error,warning:warning},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
                    // #endregion
                    if (!error && !warning) {
                        if (cacheable) {
                            resolvedVariables.set(name, value as string);
                        }
                        result += value;
                        continue variable;
                    } else {
                        break;
                    }
                }
            }

            result += `{{${name}}}`;
        }
        result += request.substring(lastIndex);
        return result;
    }

    public static async getAllVariablesDefinitions(document: TextDocument): Promise<Map<string, VariableType[]>> {
        const [, [requestProvider], [fileProvider], [environmentProvider]] = this.providers;
        const requestVariables = await (requestProvider as RequestVariableProvider).getAll(document);
        const fileVariables = await (fileProvider as FileVariableProvider).getAll(document);
        const environmentVariables = await (environmentProvider as EnvironmentVariableProvider).getAll();

        const variableDefinitions = new Map<string, VariableType[]>();

        // Request variables in file
        requestVariables.forEach(({ name }) => {
            if (variableDefinitions.has(name)) {
                variableDefinitions.get(name)!.push(VariableType.Request);
            } else {
                variableDefinitions.set(name, [VariableType.Request]);
            }
        });

        // Normal file variables
        fileVariables.forEach(({ name }) => {
            if (variableDefinitions.has(name)) {
                variableDefinitions.get(name)!.push(VariableType.File);
            } else {
                variableDefinitions.set(name, [VariableType.File]);
            }
        });

        // Environment variables
        environmentVariables.forEach(({ name }) => {
            if (variableDefinitions.has(name)) {
                variableDefinitions.get(name)!.push(VariableType.Environment);
            } else {
                variableDefinitions.set(name, [VariableType.Environment]);
            }
        });

        return variableDefinitions;
    }
}
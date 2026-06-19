/** @jsx h */
import { h, Fragment } from "preact";
import { useEffect, useRef, useReducer, useState } from "preact/hooks";
import styled, { ThemeProvider } from "styled-components";
import Channel from "common/scripts/channel.js";
import { DEFAULT_SETTINGS, getOrSetDefaultSettings } from "common/scripts/settings.js";
import Notifier from "./library/notifier/notifier.js";
import DOMPurify from "dompurify";
import { checkTimestamp } from "./Panel.jsx";
import DrawerBlock from "./DrawerBlock.jsx";
import EditIcon from "./icons/edit.svg";
import EditDoneIcon from "./icons/edit-done.svg";
import PronounceIcon from "./icons/pronounce.svg";
import PronounceLoadingIcon from "./icons/loading.jsx";
import CopyIcon from "./icons/copy.svg";

// TTS speeds
let sourceTTSSpeed = "fast",
    targetTTSSpeed = "fast";
// Communication channel.
const channel = new Channel();
const notifier = new Notifier("center");

/**
 * @param {{
 *   mainMeaning: string;
 *   originalText: string;
 *   tPronunciation?: string;
 *   sPronunciation?: string;
 *   detailedMeanings?: Array<{
 *     pos: string;
 *     meaning: string;
 *     synonyms?: Array<string>;
 *   }>;
 *   definitions?: Array<{
 *     pos: string;
 *     meaning: string;
 *     synonyms?: Array<string>;
 *     example?: string;
 *   }>;
 *   examples?: Array<{
 *     source?: string;
 *     target?: string;
 *   }>;
 * }} props translate result
 *
 * @returns {h.JSX.Element} element
 */
export default function Result(props) {
    /**
     * The order state of displaying contents.
     */
    const [contentDisplayOrder, setContentDisplayOrder] = useState([]);

    /**
     * The visible state of contents.
     */
    const [displayTPronunciation, setDisplayTPronunciation] = useState(false);
    const [displaySPronunciation, setDisplaySPronunciation] = useState(false);
    const [displayTPronunciationIcon, setDisplayTPronunciationIcon] = useState(false);
    const [displaySPronunciationIcon, setDisplaySPronunciationIcon] = useState(false);
    const [contentFilter, setContentFilter] = useState({});

    /**
     * Text direction state.
     */
    const [textDirection, setTextDirection] = useState("ltr");

    /**
     * Whether to fold too long translation content.
     */
    const [foldLongContent, setFoldLongContent] = useState(true);

    /**
     * The pronounce status
     */
    const [sourcePronouncing, setSourcePronounce] = useReducer(sourcePronounce, false),
        [sourceUKPronouncing, setSourceUKPronounce] = useReducer(sourceUKPronounce, false),
        [targetPronouncing, setTargetPronounce] = useReducer(targetPronounce, false);

    // Indicate whether user can edit and copy the translation result
    const [copyResult, setCopyResult] = useReducer(copyContent, false);
    const translateResultElRef = useRef();

    // Indicate whether user is editing the original text
    const [editing, setEditing] = useReducer(_setEditing, false);
    const originalTextElRef = useRef();

    const TargetContent = (
        <Fragment key={"mainMeaning"}>
            {props.mainMeaning?.length > 0 && (
                <Target>
                    <TextLine>
                        <div
                            dir={textDirection}
                            contenteditable={copyResult}
                            onBlur={() => setCopyResult({ copy: false })}
                            ref={translateResultElRef}
                            style={{ paddingLeft: 3 }}
                        >
                            {props.mainMeaning}
                        </div>
                        <StyledCopyIcon
                            role="button"
                            onClick={() =>
                                setCopyResult({
                                    copy: true,
                                    element: translateResultElRef.current,
                                })
                            }
                            title={window.__i18n("CopyResult")}
                        />
                    </TextLine>
                    {(displayTPronunciationIcon || displayTPronunciation) && (
                        <PronounceLine>
                            {displayTPronunciationIcon &&
                                (targetPronouncing ? (
                                    <StyledPronounceLoadingIcon />
                                ) : (
                                    <StyledPronounceIcon
                                        role="button"
                                        onClick={() => setTargetPronounce(true)}
                                    />
                                ))}
                            {displayTPronunciation && (
                                <PronounceText
                                    dir={textDirection}
                                    DrawerHeight={TextContentDrawerHeight}
                                    DisableDrawer={!foldLongContent}
                                >
                                    {props.targetPronunciation}
                                </PronounceText>
                            )}
                        </PronounceLine>
                    )}
                </Target>
            )}
        </Fragment>
    );

    const SourceContent = (
        <Fragment key={"originalText"}>
            {props.originalText?.length > 0 && (
                <Source>
                    <TextLine>
                        <div
                            dir={textDirection}
                            contenteditable={editing}
                            ref={originalTextElRef}
                            style={{ paddingLeft: 3 }}
                        >
                            {props.originalText}
                        </div>
                        {editing ? (
                            <StyledEditDoneIcon
                                role="button"
                                title={window.__i18n("Retranslate")}
                                onClick={() =>
                                    setEditing({
                                        edit: false,
                                        element: originalTextElRef.current,
                                    })
                                }
                            />
                        ) : (
                            <StyledEditIcon
                                role="button"
                                title={window.__i18n("EditText")}
                                onClick={() =>
                                    setEditing({
                                        edit: true,
                                        element: originalTextElRef.current,
                                    })
                                }
                            />
                        )}
                    </TextLine>
                    {/* US pronunciation */}
                    {(displaySPronunciationIcon || displaySPronunciation) && props.sPronunciation && (
                        <PronounceLine>
                            {displaySPronunciationIcon &&
                                (sourcePronouncing ? (
                                    <StyledPronounceLoadingIcon />
                                ) : (
                                    <StyledPronounceIcon
                                        role="button"
                                        onClick={() => setSourcePronounce(true)}
                                    />
                                ))}
                            {displaySPronunciation && (
                                <PronounceText
                                    dir={textDirection}
                                    DrawerHeight={TextContentDrawerHeight}
                                    DisableDrawer={!foldLongContent}
                                >
                                    US {props.sPronunciation}
                                </PronounceText>
                            )}
                        </PronounceLine>
                    )}
                    {/* UK pronunciation — shows when UK phonetic is available */}
                    {props.tPronunciation && (
                        <PronounceLine>
                            {sourceUKPronouncing ? (
                                <StyledPronounceLoadingIcon />
                            ) : (
                                <StyledPronounceIcon
                                    role="button"
                                    onClick={() => setSourceUKPronounce(true)}
                                />
                            )}
                            <PronounceText
                                dir={textDirection}
                                DrawerHeight={TextContentDrawerHeight}
                                DisableDrawer={!foldLongContent}
                            >
                                UK {props.tPronunciation}
                            </PronounceText>
                        </PronounceLine>
                    )}
                </Source>
            )}
        </Fragment>
    );

    // Group detailed meanings by POS and merge synonyms
    const groupedMeanings = groupMeaningsByPOS(props.detailedMeanings);

    // Synonym toggle state — one per POS group
    const [expandedSynonyms, setExpandedSynonyms] = useState({});

    // AI context translation state
    const [aiContext, setAiContext] = useState(null); // { loading: true } | { result: string } | { error: string }

    // AI context translation — manual trigger
    // AI context collapse state
    const [showAIContext, setShowAIContext] = useState(false);

    const triggerAI = async () => {
        if (!props.originalText) return;
        const text = props.originalText;
        const ctx = window._aiContext || "";
        const model = window.selectedAIModel || "default";

        console.log("[AI Translate] text:", text);
        console.log("[AI Translate] model:", model);
        console.log("[AI Translate] context (first 200 chars):", ctx.substring(0, 200));
        console.log("[AI Translate] mainMeaning:", props.mainMeaning);

        setAiContext({ loading: true, context: ctx || "(未捕获到上下文，使用原文)" });

        try {
            const result = await channel.request("ai_context_translate", {
                text, context: ctx || text,
                mainMeaning: props.mainMeaning,
                model,
            });
            console.log("[AI Translate] result:", result);
            setAiContext({ result, context: ctx || "(未捕获到上下文，使用原文)" });
        } catch (e) {
            console.error("[AI Translate] error:", e);
            setAiContext({ error: e.message || "AI 翻译失败", context: ctx || "(未捕获到上下文，使用原文)" });
        }
    };

    const AIContextContent = (
        <AIContextBlock key={"aiContext"}>
            <AIContextHead>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <AIContextSpot />
                    <AIContextTitle>AI 上下文翻译</AIContextTitle>
                </span>
                {!aiContext?.loading && !aiContext?.result && !aiContext?.error && (
                    <AITriggerIcon
                        role="button"
                        title="AI 分析上下文"
                        onClick={triggerAI}
                    />
                )}
                {(aiContext?.loading || aiContext?.result || aiContext?.error) && (
                    <AITriggerIcon
                        role="button"
                        title="重新分析"
                        onClick={triggerAI}
                        style={{ opacity: 0.5 }}
                    />
                )}
            </AIContextHead>
            <BlockSplitLine />
            {/* Show captured context — always visible when AI is triggered */}
            {aiContext && (
                <AIContextSource>
                    <AIContextSourceToggle onClick={() => setShowAIContext(!showAIContext)}>
                        读取的上下文 {showAIContext ? "▲" : "▼"}
                    </AIContextSourceToggle>
                    {showAIContext && <AIContextSourceText>{aiContext.context || "(无上下文)"}</AIContextSourceText>}
                </AIContextSource>
            )}
            {aiContext?.loading ? (
                <AILoading>AI 分析中...</AILoading>
            ) : aiContext?.error ? (
                <AIError>⚠ {aiContext.error} <AIContextRetry onClick={triggerAI}>重试</AIContextRetry></AIError>
            ) : aiContext?.result ? (
                <AIContextText dir={textDirection}>{aiContext.result}</AIContextText>
            ) : null}
        </AIContextBlock>
    );

    const DetailContent = (
        <Fragment key={"detailedMeanings"}>
            {props.detailedMeanings?.length > 0 && (
                <Detail>
                    <BlockHead>
                        <DetailHeadSpot />
                        <BlockHeadTitle>
                            {window.__i18n("DetailedMeanings")}
                        </BlockHeadTitle>
                        <BlockSplitLine />
                    </BlockHead>
                    <BlockContent
                        DrawerHeight={BlockContentDrawerHeight}
                        DisableDrawer={!foldLongContent}
                    >
                        {groupedMeanings.map((group, groupIndex) => (
                            <POSGroup key={`pos-group-${groupIndex}`}>
                                <POSRow dir={textDirection}>
                                    <POSTag dir={textDirection}>{group.pos}</POSTag>
                                    <MeaningText dir={textDirection}>
                                        {group.meanings.join("，")}
                                    </MeaningText>
                                </POSRow>
                                {group.synonyms.length > 0 && (
                                    <SynonymSection>
                                        <SynonymToggle
                                            onClick={() =>
                                                setExpandedSynonyms((prev) => ({
                                                    ...prev,
                                                    [groupIndex]: !prev[groupIndex],
                                                }))
                                            }
                                        >
                                            {expandedSynonyms[groupIndex] ? "收起" : `展开 ${group.synonyms.length} 个同义词`}
                                            <ArrowIcon expanded={!!expandedSynonyms[groupIndex]} />
                                        </SynonymToggle>
                                        {expandedSynonyms[groupIndex] && (
                                            <SynonymLine>
                                                {group.synonyms.map((word, si) => (
                                                    <SynonymWord key={`synonym-${groupIndex}-${si}`}>
                                                        {word}
                                                    </SynonymWord>
                                                ))}
                                            </SynonymLine>
                                        )}
                                    </SynonymSection>
                                )}
                            </POSGroup>
                        ))}
                    </BlockContent>
                </Detail>
            )}
        </Fragment>
    );

    const DefinitionContent = (
        <Fragment key={"definitions"}>
            {props.definitions?.length > 0 && (
                <Definition>
                    <BlockHead>
                        <DefinitionHeadSpot />
                        <BlockHeadTitle>{window.__i18n("Definitions")}</BlockHeadTitle>
                        <BlockSplitLine />
                    </BlockHead>
                    <BlockContent
                        DrawerHeight={BlockContentDrawerHeight}
                        DisableDrawer={!foldLongContent}
                    >
                        {props.definitions.map((definition, definitionIndex) => (
                            <Fragment key={`definition-${definitionIndex}`}>
                                <Position dir={textDirection}>{definition.pos}</Position>
                                <DetailMeaning dir={textDirection}>
                                    {definition.meaning}
                                </DetailMeaning>
                                {definition.example && (
                                    <DefinitionExample
                                        dir={textDirection}
                                    >{`"${definition.example}"`}</DefinitionExample>
                                )}
                                {definition.synonyms?.length > 0 && (
                                    <Fragment>
                                        <SynonymTitle dir={textDirection}>
                                            {window.__i18n("Synonyms")}
                                        </SynonymTitle>
                                        <SynonymLine>
                                            {definition.synonyms.map((word, synonymIndex) => (
                                                <SynonymWord
                                                    key={`definition-synonym-${synonymIndex}`}
                                                    dir={textDirection}
                                                >
                                                    {word}
                                                </SynonymWord>
                                            ))}
                                        </SynonymLine>
                                    </Fragment>
                                )}
                            </Fragment>
                        ))}
                    </BlockContent>
                </Definition>
            )}
        </Fragment>
    );

    const ExampleContent = (
        <Fragment key={"examples"}>
            {props.examples?.length > 0 && (
                <Example>
                    <BlockHead>
                        <ExampleHeadSpot />
                        <BlockHeadTitle>{window.__i18n("Examples")}</BlockHeadTitle>
                        <BlockSplitLine />
                    </BlockHead>
                    <BlockContent
                        DrawerHeight={BlockContentDrawerHeight}
                        DisableDrawer={!foldLongContent}
                    >
                        <ExampleList dir={textDirection}>
                            {props.examples.map((example, index) => (
                                <ExampleItem key={`example-${index}`}>
                                    {example.source && (
                                        <ExampleSource
                                            dangerouslySetInnerHTML={{
                                                __html: DOMPurify.sanitize(example.source, {
                                                    ALLOWED_TAGS: ["b"],
                                                }),
                                            }}
                                        />
                                    )}
                                    {example.target && (
                                        <ExampleTarget
                                            // eslint-disable-next-line react/no-danger
                                            dangerouslySetInnerHTML={{
                                                __html: DOMPurify.sanitize(example.target, {
                                                    ALLOWED_TAGS: ["b"],
                                                }),
                                            }}
                                        />
                                    )}
                                </ExampleItem>
                            ))}
                        </ExampleList>
                    </BlockContent>
                </Example>
            )}
        </Fragment>
    );

    /**
     * Content maps.
     */
    const CONTENTS = {
        mainMeaning: TargetContent,
        originalText: SourceContent,
        aiContext: AIContextContent,
        detailedMeanings: DetailContent,
        definitions: DefinitionContent,
        examples: ExampleContent,
    };

    useEffect(() => {
        sourceTTSSpeed = "fast";
        targetTTSSpeed = "fast";

        /*
         * COMMUNICATE WITH BACKGROUND MODULE
         */
        const cancelers = [];
        cancelers.push(
            channel.on("pronouncing_finished", (detail) => {
                if (checkTimestamp(detail.timestamp)) {
                    if (detail.pronouncing === "source") setSourcePronounce(false);
                    else if (detail.pronouncing === "sourceUK") setSourceUKPronounce(false);
                    else if (detail.pronouncing === "target") setTargetPronounce(false);
                }
            })
        );

        cancelers.push(
            channel.on("pronouncing_error", (detail) => {
                if (checkTimestamp(detail.timestamp)) {
                    if (detail.pronouncing === "source") setSourcePronounce(false);
                    else if (detail.pronouncing === "sourceUK") setSourceUKPronounce(false);
                    else if (detail.pronouncing === "target") setTargetPronounce(false);
                    notifier.notify({
                        type: "error",
                        title: window.__i18n("AppName"),
                        detail: window.__i18n("PRONOUN_ERR"),
                    });
                }
            })
        );

        cancelers.push(
            channel.on("command", (detail) => {
                switch (detail.command) {
                    case "pronounce_original":
                        setSourcePronounce(true);
                        break;
                    case "pronounce_translated":
                        setTargetPronounce(true);
                        break;
                    case "copy_result":
                        if (window.translateResult.mainMeaning && translateResultElRef.current) {
                            setCopyResult({ copy: true, element: translateResultElRef.current });
                        }
                        break;
                    default:
                        break;
                }
            })
        );

        /**
         * Update displaying contents based on user's setting.
         */
        getOrSetDefaultSettings(
            ["LayoutSettings", "TranslateResultFilter", "ContentDisplayOrder"],
            DEFAULT_SETTINGS
        ).then((result) => {
            setContentDisplayOrder(result.ContentDisplayOrder);
            setDisplaySPronunciation(result.TranslateResultFilter["sPronunciation"]);
            setDisplayTPronunciation(result.TranslateResultFilter["tPronunciation"]);
            setDisplaySPronunciationIcon(result.TranslateResultFilter["sPronunciationIcon"]);
            setDisplayTPronunciationIcon(result.TranslateResultFilter["tPronunciationIcon"]);
            setContentFilter(result.TranslateResultFilter);
            setTextDirection(result.LayoutSettings.RTL ? "rtl" : "ltr");
            setFoldLongContent(result.LayoutSettings.FoldLongContent);
        });
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== "sync") return;

            if (changes.ContentDisplayOrder) {
                setContentDisplayOrder(changes.ContentDisplayOrder.newValue);
            }

            if (changes.TranslateResultFilter) {
                setDisplaySPronunciation(changes.TranslateResultFilter.newValue["sPronunciation"]);
                setDisplayTPronunciation(changes.TranslateResultFilter.newValue["tPronunciation"]);
                setDisplaySPronunciationIcon(
                    changes.TranslateResultFilter.newValue["sPronunciationIcon"]
                );
                setDisplayTPronunciationIcon(
                    changes.TranslateResultFilter.newValue["tPronunciationIcon"]
                );
                setContentFilter(changes.TranslateResultFilter.newValue);
            }

            if (changes.LayoutSettings) {
                setTextDirection(changes.LayoutSettings.newValue.RTL ? "rtl" : "ltr");
                setFoldLongContent(changes.LayoutSettings.newValue.FoldLongContent);
            }
        });

        return () => {
            // remove all of event listeners before destroying the component
            cancelers.forEach((canceler) => canceler());
        };
    }, []);

    // Long text mode: simplified segment view with bidirectional highlight + word lookup
    if (props.longTextMode) {
        return (
            <ThemeProvider theme={(props) => ({ ...props, textDirection })}>
                <SegmentViewWithLookup
                    originalText={props.originalText}
                    mainMeaning={props.mainMeaning}
                    textDirection={textDirection}
                    sourceLanguage={props.sourceLanguage || "auto"}
                    targetLanguage={props.targetLanguage || "zh-CN"}
                />
            </ThemeProvider>
        );
    }

    return (
        <Fragment>
            <ThemeProvider theme={(props) => ({ ...props, textDirection })}>
                {props.errors && props.errors.length > 0 && (
                    <ErrorBanner>
                        {props.errors.map((e, i) => (
                            <div key={i}>{e}</div>
                        ))}
                    </ErrorBanner>
                )}
                {contentDisplayOrder
                    .filter((content) => contentFilter[content])
                    .map((content) => CONTENTS[content])}
            </ThemeProvider>
        </Fragment>
    );
}

/**
 * Split text into sentences by punctuation boundaries.
 */
function splitSentences(text) {
    const parts = (text || "").split(/(?<=[.!?。！？\n])\s*/);
    return parts.filter(s => s.trim());
}

/**
 * Wraps SegmentView + WordLookupPanel for long text mode.
 */
function SegmentViewWithLookup({ originalText, mainMeaning, textDirection, sourceLanguage, targetLanguage }) {
    const [lookupWord, setLookupWord] = useState("");

    return (
        <Fragment>
            <SegmentView
                originalText={originalText}
                mainMeaning={mainMeaning}
                textDirection={textDirection}
                onWordClick={(word) => setLookupWord(lookupWord === word ? "" : word)}
                lookupWord={lookupWord}
            />
            {lookupWord && (
                <WordLookupPanel
                    word={lookupWord}
                    sourceLanguage={sourceLanguage}
                    targetLanguage={targetLanguage}
                />
            )}
        </Fragment>
    );
}

/**
 * Long text segment view: two big blocks with sentence-level bidirectional hover/click highlight.
 */
function SegmentView({ originalText, mainMeaning, textDirection, onWordClick, lookupWord }) {
    const [pinnedIndex, setPinnedIndex] = useState(-1);
    const [hoverIndex, setHoverIndex] = useState(-1);

    const srcSentences = splitSentences(originalText);
    const tgtSentences = splitSentences(mainMeaning);
    const maxLen = Math.max(srcSentences.length, tgtSentences.length);

    const activeIdx = hoverIndex !== -1 ? hoverIndex : pinnedIndex;

    // Split text into clickable words, matching the word in lookupWord
    const renderWords = (text, isSource) => {
        const words = text.split(/(\s+)/);
        return words.map((w, j) => {
            if (/^\s+$/.test(w)) return w; // preserve whitespace
            const trimmed = w.trim();
            if (!trimmed) return w;
            const isActive = lookupWord && trimmed.toLowerCase() === lookupWord.toLowerCase();
            return (
                <WordSpan
                    key={j}
                    active={isActive}
                    onClick={(e) => { e.stopPropagation(); onWordClick && onWordClick(trimmed); }}
                >
                    {w}
                </WordSpan>
            );
        });
    };

    return (
        <SegmentContainer>
            <SegmentBlock label="译文" textDirection={textDirection}>
                {tgtSentences.map((s, i) => (
                    <SegmentSpan
                        key={i}
                        active={i === activeIdx}
                        onMouseEnter={() => setHoverIndex(i)}
                        onMouseLeave={() => setHoverIndex(-1)}
                        onClick={() => setPinnedIndex(pinnedIndex === i ? -1 : i)}
                    >
                        {renderWords(s, false)}
                    </SegmentSpan>
                ))}
                {tgtSentences.length < maxLen && Array.from({ length: maxLen - tgtSentences.length }).map((_, i) => (
                    <SegmentSpan key={`tpad-${i}`} active={false} />
                ))}
            </SegmentBlock>
            <SegmentBlock label="原文" textDirection={textDirection}>
                {srcSentences.map((s, i) => (
                    <SegmentSpan
                        key={i}
                        active={i === activeIdx}
                        onMouseEnter={() => setHoverIndex(i)}
                        onMouseLeave={() => setHoverIndex(-1)}
                        onClick={() => setPinnedIndex(pinnedIndex === i ? -1 : i)}
                    >
                        {renderWords(s, true)}
                    </SegmentSpan>
                ))}
                {srcSentences.length < maxLen && Array.from({ length: maxLen - srcSentences.length }).map((_, i) => (
                    <SegmentSpan key={`spad-${i}`} active={false} />
                ))}
            </SegmentBlock>
        </SegmentContainer>
    );
}

/**
 * Word lookup panel: translates a single word and shows dictionary result
 * using the same format as the normal (non-long-text) translation result.
 */
function WordLookupPanel({ word, sourceLanguage, targetLanguage }) {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setResult(null);

        channel.request("word_lookup", {
            text: word,
            from: sourceLanguage,
            to: targetLanguage,
        }).then((data) => {
            if (cancelled) return;
            setResult(data?.error ? { error: data.error.message || data.error } : data);
        }).catch((err) => {
            if (cancelled) return;
            setResult({ error: err?.message || String(err) });
        }).finally(() => {
            if (!cancelled) setLoading(false);
        });

        return () => { cancelled = true; };
    }, [word, sourceLanguage, targetLanguage]);

    if (loading || !result) {
        return <LookupPanel><LookupLoading>查询 "{word}" 中...</LookupLoading></LookupPanel>;
    }

    if (result.error) {
        return <LookupPanel><LookupError>查询失败: {result.error}</LookupError></LookupPanel>;
    }

    // Group detailed meanings by POS (same logic as main Result)
    const groupedMeanings = groupMeaningsByPOS(result.detailedMeanings);
    const [expandedSynonyms, setExpandedSynonyms] = useState({});
    const [showDetails, setShowDetails] = useState(false);
    const hasDetails = groupedMeanings.length > 0 || result.definitions?.length > 0 || result.examples?.length > 0;

    return (
        <Fragment>
            <LookupPanel>
                {/* Compact preview line — always visible, click to expand */}
                <LookupPreview onClick={() => hasDetails && setShowDetails(!showDetails)} expandable={hasDetails}>
                    <LookupWord>{result.originalText || word}</LookupWord>
                    {(result.sPronunciation || result.tPronunciation) && (
                        <LookupPhonetic>
                            {result.sPronunciation && <span>US {result.sPronunciation}</span>}
                            {result.tPronunciation && <span>  UK {result.tPronunciation}</span>}
                        </LookupPhonetic>
                    )}
                    {result.mainMeaning && <LookupMain>{result.mainMeaning}</LookupMain>}
                    {hasDetails && <ExpandHint>{showDetails ? "收起 ▲" : "展开 ▼"}</ExpandHint>}
                </LookupPreview>
            </LookupPanel>

            {showDetails && (
                <Fragment>

            {/* Detailed Meanings — same format as main Result */}
            {groupedMeanings.length > 0 && (
                <Detail>
                    <BlockHead>
                        <DetailHeadSpot />
                        <BlockHeadTitle>{window.__i18n("DetailedMeanings")}</BlockHeadTitle>
                        <BlockSplitLine />
                    </BlockHead>
                    <BlockContent DrawerHeight={BlockContentDrawerHeight} DisableDrawer>
                        {groupedMeanings.map((group, groupIndex) => (
                            <POSGroup key={`lkp-pos-${groupIndex}`}>
                                <POSRow>
                                    <POSTag>{group.pos}</POSTag>
                                    <MeaningText>{group.meanings.join("，")}</MeaningText>
                                </POSRow>
                                {group.synonyms.length > 0 && (
                                    <SynonymSection>
                                        <SynonymToggle onClick={() =>
                                            setExpandedSynonyms((prev) => ({ ...prev, [groupIndex]: !prev[groupIndex] }))
                                        }>
                                            {expandedSynonyms[groupIndex] ? "收起" : `展开 ${group.synonyms.length} 个同义词`}
                                            <ArrowIcon expanded={!!expandedSynonyms[groupIndex]} />
                                        </SynonymToggle>
                                        {expandedSynonyms[groupIndex] && (
                                            <SynonymLine>
                                                {group.synonyms.map((syn, si) => (
                                                    <SynonymWord key={`lkp-syn-${groupIndex}-${si}`}>{syn}</SynonymWord>
                                                ))}
                                            </SynonymLine>
                                        )}
                                    </SynonymSection>
                                )}
                            </POSGroup>
                        ))}
                    </BlockContent>
                </Detail>
            )}

            {/* Definitions — same format as main Result */}
            {result.definitions?.length > 0 && (
                <Definition>
                    <BlockHead>
                        <DefinitionHeadSpot />
                        <BlockHeadTitle>{window.__i18n("Definitions")}</BlockHeadTitle>
                        <BlockSplitLine />
                    </BlockHead>
                    <BlockContent DrawerHeight={BlockContentDrawerHeight} DisableDrawer>
                        {result.definitions.map((def, i) => (
                            <Fragment key={`lkp-def-${i}`}>
                                <Position>{def.pos}</Position>
                                <DetailMeaning>{def.meaning}</DetailMeaning>
                                {def.example && <DefinitionExample>{`"${def.example}"`}</DefinitionExample>}
                                {def.synonyms?.length > 0 && (
                                    <Fragment>
                                        <SynonymTitle>{window.__i18n("Synonyms")}</SynonymTitle>
                                        <SynonymLine>
                                            {def.synonyms.map((syn, si) => (
                                                <SynonymWord key={`lkp-defsyn-${si}`}>{syn}</SynonymWord>
                                            ))}
                                        </SynonymLine>
                                    </Fragment>
                                )}
                            </Fragment>
                        ))}
                    </BlockContent>
                </Definition>
            )}

            {/* Examples — same format as main Result */}
            {result.examples?.length > 0 && (
                <Example>
                    <BlockHead>
                        <ExampleHeadSpot />
                        <BlockHeadTitle>{window.__i18n("Examples")}</BlockHeadTitle>
                        <BlockSplitLine />
                    </BlockHead>
                    <BlockContent DrawerHeight={BlockContentDrawerHeight} DisableDrawer>
                        <ExampleList>
                            {result.examples.map((ex, i) => (
                                <ExampleItem key={`lkp-ex-${i}`}>
                                    {ex.source && <ExampleSource dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ex.source, { ALLOWED_TAGS: ["b"] }) }} />}
                                    {ex.target && <ExampleTarget dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ex.target, { ALLOWED_TAGS: ["b"] }) }} />}
                                </ExampleItem>
                            ))}
                        </ExampleList>
                    </BlockContent>
                </Example>
            )}
            </Fragment>
            )}
        </Fragment>
    );
}

/**
 * Group detailed meanings by POS tag and merge synonyms within each group.
 * Deduplicates meanings and synonyms to avoid visual repetition.
 *
 * @param {Array<{pos: string; meaning: string; synonyms?: Array<string>}>} meanings raw detailed meanings
 * @returns {Array<{pos: string; meanings: string[]; synonyms: string[]}>} grouped and deduplicated meanings
 */
function groupMeaningsByPOS(meanings) {
    if (!meanings?.length) return [];

    const groups = new Map();
    for (const item of meanings) {
        if (!groups.has(item.pos)) {
            groups.set(item.pos, { meanings: new Set(), synonyms: new Set() });
        }
        const group = groups.get(item.pos);
        group.meanings.add(item.meaning);
        if (item.synonyms) {
            for (const s of item.synonyms) {
                // Skip synonyms that are identical to any meaning in this group
                if (!group.meanings.has(s)) {
                    group.synonyms.add(s);
                }
            }
        }
    }

    return Array.from(groups.entries()).map(([pos, group]) => ({
        pos,
        meanings: Array.from(group.meanings),
        synonyms: Array.from(group.synonyms),
    }));
}

/**
 * STYLE FOR THE COMPONENT START
 */

const BlockPadding = "10px";
const BlockMargin = "8px";
const LightPrimary = "rgba(74, 140, 247, 0.7)";
const Gray = "#919191";
const BlockContentDrawerHeight = 150; // drawer height for blocks
const TextContentDrawerHeight = 50; // drawer height for texts

/**
 * basic style for a block used to display content
 */
export const Block = styled.div`
    width: calc(100% - 2 * ${BlockMargin});
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    padding: ${BlockPadding};
    margin: ${BlockMargin};
    margin-top: 0;
    background-color: rgb(250, 250, 250);
    border-radius: 10px;
    /* box-shadow: 0px 3px 6px rgba(127, 127, 127, 0.25); */
    line-height: 120%;
    letter-spacing: 0.02em;
`;

const Source = styled(Block)`
    font-weight: normal;
    white-space: pre-wrap;
`;

const Target = styled(Block)`
    font-weight: normal;
    white-space: pre-wrap;
`;

const Detail = styled(Block)`
    font-weight: normal;
`;

const TextLine = styled.div`
    width: 100%;
    display: flex;
    margin: 5px 0;
    flex-direction: ${(props) => (props.theme.textDirection === "ltr" ? "row" : "row-reverse")};
    justify-content: space-between;
    align-items: center;
`;

const StyledEditIcon = styled(EditIcon)`
    width: 18px;
    height: 18px;
    fill: ${Gray};
    flex-shrink: 0;
    margin-left: 2px;
    transition: fill 0.2s linear;
    &:hover {
        fill: dimgray;
    }
`;

const StyledEditDoneIcon = styled(EditDoneIcon)`
    width: 18px;
    height: 18px;
    fill: ${Gray};
    flex-shrink: 0;
    margin-left: 2px;
    transition: fill 0.2s linear;
    &:hover {
        fill: dimgray;
    }
`;

const PronounceLine = styled.div`
    width: 100%;
    margin: 5px 0;
    display: flex;
    flex-direction: ${(props) => (props.theme.textDirection === "ltr" ? "row" : "row-reverse")};
    justify-content: flex-start;
    align-items: center;
`;

const PronounceText = styled(DrawerBlock)`
    color: ${Gray};
`;

const StyledCopyIcon = styled(CopyIcon)`
    width: 20px;
    height: 20px;
    fill: ${Gray};
    flex-shrink: 0;
    margin-left: 2px;
    transition: fill 0.2s linear;
    &:hover {
        fill: dimgray;
    }
`;

const StyledPronounceIcon = styled(PronounceIcon)`
    width: 20px;
    height: 20px;
    padding: 2px;
    margin-right: 10px;
    fill: ${LightPrimary};
    flex-shrink: 0;
    transition: fill 0.2s linear;
    ${(props) =>
        props.theme.textDirection === "ltr"
            ? `
                margin-right: 10px;
            `
            : `
                margin-left: 10px;
                transform: rotate(180deg);
            `}

    &:hover {
        fill: orange !important;
    }
`;

const StyledPronounceLoadingIcon = styled(PronounceLoadingIcon)`
    width: 24px;
    height: 24px;
    margin-right: 10px;
    fill: ${LightPrimary};
    padding: 0;
    flex-shrink: 0;

    circle {
        fill: none;
        stroke: ${LightPrimary} !important;
    }
`;

const BlockHead = styled.div`
    width: 100%;
    display: flex;
    flex-direction: ${(props) => (props.theme.textDirection === "ltr" ? "row" : "row-reverse")};
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: center;
`;

const BlockHeadTitle = styled.span`
    font-size: small;
    ${(props) =>
        `${props.theme.textDirection === "ltr" ? "margin-left" : "margin-right"}:${BlockPadding}`}
`;

/**
 * common style for the spot of block head
 */
const BlockHeadSpot = styled.span`
    width: 10px;
    height: 10px;
    border-radius: 50%;
`;

const BlockSplitLine = styled.div`
    width: 100%;
    height: 1px;
    margin: 5px 0;
    flex-shrink: 0;
    border: none;
    background: rgba(0, 0, 0, 0.25);
`;

const BlockContent = styled(DrawerBlock)`
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: ${(props) => (props.theme.textDirection === "ltr" ? "flex-start" : "flex-end")};
    flex-shrink: 0;
`;

const DetailHeadSpot = styled(BlockHeadSpot)`
    background-color: #00bfa5;
`;

const Position = styled.div`
    color: ${Gray};
    font-size: smaller;
`;

const DetailMeaning = styled.div`
    padding: 5px 0;
    ${(props) => (props.theme.textDirection === "ltr" ? "margin-left" : "margin-right")}: 10px;
`;

const POSGroup = styled.div`
    width: 100%;
    margin-bottom: 14px;
    &:last-child {
        margin-bottom: 0;
    }
`;

const POSRow = styled.div`
    display: flex;
    align-items: baseline;
    gap: 8px;
    ${(props) => (props.theme.textDirection === "ltr" ? "" : "flex-direction: row-reverse;")}
`;

const POSTag = styled.span`
    display: inline-block;
    font-size: 11px;
    font-weight: 500;
    color: #8c8c8c;
    background: #f5f5f5;
    padding: 2px 6px;
    border-radius: 2px;
    letter-spacing: 0.03em;
    flex-shrink: 0;
    ${(props) => (props.theme.textDirection === "rtl" ? "margin-left: 8px;" : "")}
`;

const MeaningText = styled.span`
    font-size: 14px;
    color: #262626;
    line-height: 1.6;
`;

const SynonymSection = styled.div`
    margin-top: 4px;
    ${(props) => (props.theme.textDirection === "ltr" ? "padding-left: 4px;" : "padding-right: 4px;")}
`;

const SynonymToggle = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #1890ff;
    cursor: pointer;
    user-select: none;
    &:hover {
        color: #40a9ff;
    }
`;

const ArrowIcon = styled.span`
    display: inline-block;
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid #1890ff;
    transition: transform 0.2s;
    ${(props) => (props.expanded ? "transform: rotate(180deg);" : "")}
`;

const SynonymLine = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px 0 2px;
`;

const SynonymWord = styled.span`
    font-size: 12px;
    color: #595959;
    background: #fafafa;
    padding: 2px 8px;
    border-radius: 2px;
    cursor: default;
    transition: background 0.15s;
    &:hover {
        background: #f0f0f0;
    }
`;

const Definition = styled(Block)``;

const DefinitionHeadSpot = styled(BlockHeadSpot)`
    background-color: #ff4081;
`;

const DefinitionExample = styled(DetailMeaning)`
    color: #5f6368;
`;

const AIContextBlock = styled(Block)``;

const AIContextSpot = styled(BlockHeadSpot)`
    background: linear-gradient(135deg, #667eea, #764ba2);
`;

const AIContextText = styled.div`
    font-size: 14px;
    color: #262626;
    line-height: 1.6;
    padding: 4px 0;
`;

const AILoading = styled.div`
    font-size: 13px;
    color: #8c8c8c;
    padding: 8px 0;
`;

const AIError = styled.div`
    font-size: 13px;
    color: #ff4d4f;
    padding: 4px 0;
`;

const AIContextRetry = styled.span`
    color: #1890ff;
    cursor: pointer;
    margin-left: 8px;
    font-size: 12px;
    &:hover { color: #40a9ff; }
`;

const AIContextSource = styled.div`
    margin: 4px 0 8px;
`;

const AIContextSourceToggle = styled.span`
    font-size: 11px;
    color: #8c8c8c;
    cursor: pointer;
    user-select: none;
    &:hover { color: #595959; }
`;

const AIContextSourceText = styled.div`
    margin-top: 4px;
    padding: 8px;
    background: #fafafa;
    border: 1px solid #f0f0f0;
    border-radius: 4px;
    font-size: 12px;
    color: #8c8c8c;
    line-height: 1.5;
    max-height: 120px;
    overflow-y: auto;
    word-break: break-all;
`;

const AIContextHead = styled(BlockHead)`
    justify-content: space-between;
`;

const AIContextTitle = styled(BlockHeadTitle)``;

const AITriggerIcon = styled.div`
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #667eea;
    border-radius: 50%;
    font-size: 10px;
    font-weight: 700;
    color: #667eea;
    transition: all 0.2s;
    &:hover {
        background: #667eea;
        color: #fff;
    }
    &::before {
        content: "AI";
    }
`;

const Example = styled(Block)``;

const ExampleHeadSpot = styled(BlockHeadSpot)`
    background-color: #3d5afe;
`;

const ExampleList = styled.ol`
    list-style-type: decimal;
    ${(props) => (props.theme.textDirection === "ltr" ? "padding-left" : "padding-right")}: 1.5rem;
    margin: 0;
`;

const ExampleItem = styled.li`
    padding: 5px 0;
    font-size: small;
`;

const ExampleSource = styled.div`
    font-size: medium;
`;

const ExampleTarget = styled.div`
    padding-top: 5px;
    font-size: medium;
`;

/**
 * STYLE FOR THE COMPONENT END
 */

// ── SegmentView (long text mode) ──

const SegmentContainer = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const SegmentBlock = styled.div`
    padding: 10px 12px;
    border-radius: 8px;
    background: #fafafa;
    line-height: 1.8;
    font-size: 14px;
    user-select: none;
    cursor: default;
    &::before {
        content: "${(props) => props.label || ''}";
        display: block;
        font-size: 11px;
        color: #8c8c8c;
        margin-bottom: 6px;
        font-weight: 500;
    }
`;

const SegmentSpan = styled.span`
    cursor: pointer;
    border-radius: 3px;
    padding: 1px 2px;
    transition: background 0.12s, color 0.12s;
    background: ${(props) => (props.active ? "rgba(255, 235, 59, 0.5)" : "transparent")};
    color: ${(props) => (props.active ? "#1565c0" : "inherit")};
    &:hover {
        background: rgba(255, 235, 59, 0.35);
    }
`;

const WordSpan = styled.span`
    cursor: pointer;
    border-radius: 2px;
    padding: 0 1px;
    text-decoration: ${(props) => (props.active ? "underline" : "none")};
    background: ${(props) => (props.active ? "rgba(33, 150, 243, 0.2)" : "transparent")};
    &:hover {
        background: rgba(33, 150, 243, 0.15);
    }
`;

// ── WordLookupPanel ──

const LookupPanel = styled.div`
    margin-top: 12px;
    border-radius: 8px;
    background: #f5f8ff;
    border: 1px solid #e3edf7;
    overflow: hidden;
`;

const LookupLoading = styled.div`
    color: #8c8c8c;
    font-size: 13px;
    padding: 10px 14px;
`;

const LookupError = styled.div`
    color: #ff4d4f;
    font-size: 13px;
    padding: 10px 14px;
`;

const LookupPreview = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
    padding: 8px 14px;
    cursor: ${(props) => (props.expandable ? "pointer" : "default")};
    &:hover {
        background: ${(props) => (props.expandable ? "rgba(33,150,243,0.04)" : "transparent")};
    }
`;

const LookupWord = styled.span`
    font-size: 15px;
    font-weight: 600;
    color: #1565c0;
`;

const LookupPhonetic = styled.span`
    font-size: 12px;
    color: #8c8c8c;
`;

const LookupMain = styled.span`
    font-size: 14px;
    color: #262626;
`;

const ExpandHint = styled.span`
    font-size: 11px;
    color: #b0b0b0;
    margin-left: auto;
`;

const ErrorBanner = styled.div`
    background: #fff3f3;
    color: #d32f2f;
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 4px;
    margin-bottom: 8px;
    line-height: 1.5;
`;



/**
 * A reducer for source pronouncing state
 * Send message to background to pronounce the translating text.
 */
function sourcePronounce(_, startPronounce) {
    if (startPronounce)
        channel
            .request("pronounce", {
                pronouncing: "source",
                text: window.translateResult.originalText,
                language: window.translateResult.sourceLanguage,
                speed: sourceTTSSpeed,
            })
            .then(() => {
                if (sourceTTSSpeed === "fast") {
                    sourceTTSSpeed = "slow";
                } else {
                    sourceTTSSpeed = "fast";
                }
            });
    return startPronounce;
}

/**
 * A reducer for UK source pronouncing state.
 */
let sourceUKTTSSpeed = "fast";
function sourceUKPronounce(_, startPronounce) {
    if (startPronounce)
        channel
            .request("pronounce", {
                pronouncing: "sourceUK",
                text: window.translateResult.originalText,
                language: window.translateResult.sourceLanguage,
                speed: sourceUKTTSSpeed,
            })
            .then(() => {
                sourceUKTTSSpeed = sourceUKTTSSpeed === "fast" ? "slow" : "fast";
            });
    return startPronounce;
}

/**
 * A reducer for target pronouncing state
 */
function targetPronounce(_, startPronounce) {
    if (startPronounce)
        channel
            .request("pronounce", {
                pronouncing: "target",
                text: window.translateResult.mainMeaning,
                language: window.translateResult.targetLanguage,
                speed: targetTTSSpeed,
            })
            .then(() => {
                if (targetTTSSpeed === "fast") {
                    targetTTSSpeed = "slow";
                } else {
                    targetTTSSpeed = "fast";
                }
            });
    return startPronounce;
}

/**
 * A reducer for copying state of translation result
 * @param {*} _
 * @param {
 *     copy: boolean;  // new state
 *     element: HTMLElement; // the element for displaying translation results
 * } action
 */
function copyContent(_, action) {
    if (action.copy && action.element) {
        /**
         * This line is to make sure the div element is editable before the focus action.
         * Because of the react mechanism, contenteditable={copyResult} will work after this function is executed.
         */
        action.element.setAttribute("contenteditable", "true");

        action.element.focus();

        // select all content automatically
        let range = document.createRange();
        range.selectNodeContents(action.element);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);

        document.execCommand("copy");
    } else if (!action.copy) window.getSelection().removeAllRanges();
    return action.copy;
}

/**
 * The following 4 functions are intended to prevent input events from being caught by other elements.
 */

/**
 * Prevent keydown event from propagation.
 *
 * @param {Event} event keydown event.
 */
function onKeyDownInTextEditor(event) {
    event.stopPropagation();
}

/**
 * Prevent keyup event from propagation.
 *
 * @param {Event} event keyup event.
 */
function onKeyUpInTextEditor(event) {
    event.stopPropagation();
}

/**
 * When the input box gets focused, prevent input events from propagation.
 *
 * @param {Event} event focus event.
 */
function onTextEditorFocused(event) {
    event.target.addEventListener("keydown", onKeyDownInTextEditor);
    event.target.addEventListener("keyup", onKeyUpInTextEditor);
}

/**
 * When the input box gets blurred, allow input events propagation.
 *
 * @param {Event} event blur event.
 */
function onTextEditorBlurred(event) {
    event.target.removeEventListener("keydown", onKeyDownInTextEditor);
    event.target.removeEventListener("keyup", onKeyUpInTextEditor);
}

/**
 * Edit original text.
 *
 * @param {HTMLElement} originalTextEle original text element
 */
function editOriginalText(originalTextEle) {
    // Prevent input events from propagation.
    originalTextEle.addEventListener("focus", onTextEditorFocused);
    originalTextEle.addEventListener("blur", onTextEditorBlurred);

    /**
     * Make the editable element automatically focus.
     * Use setTimeout because of https://stackoverflow.com/a/37162116.
     */
    setTimeout(() => originalTextEle.focus());
}

/**
 * Submit and translate edited text.
 *
 * @param {HTMLElement} originalTextEle original text element
 */
function submitEditedText(originalTextEle) {
    // Allow input events propagation.
    originalTextEle.removeEventListener("focus", onTextEditorFocused);
    originalTextEle.removeEventListener("blur", onTextEditorBlurred);

    let text = originalTextEle.textContent.trim();
    if (text.length > 0) {
        // to make sure the new text is different from the original text
        if (text.valueOf() !== window.translateResult.originalText.valueOf()) {
            // Do translating.
            channel.request("translate", { text });
        }
    } else {
        // Restore original text.
        originalTextEle.textContent = window.translateResult.originalText;
    }
}

/**
 * A reducer for updating editing state of original text.
 *
 * @param {any} _ nothing
 * @param {{edit: boolean; element: HTMLElement;}} state new state information
 * @returns new state
 */
function _setEditing(_, state) {
    if (state.element) {
        if (state.edit) {
            editOriginalText(state.element);
        } else {
            submitEditedText(state.element);
        }
    }
    return state.edit;
}

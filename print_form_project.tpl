<!--{if $empMembership['groupID'][435]}-->
<!-- Project Dashboard - READ ONLY user group. Granting people into this group will give them read only access. The team must also be added to this view as well though, as well as LEAF Team (group 12). -->
<div class="pm-wrap">
  <span
    id="pmEnv"
    data-csrf="{$CSRFToken}"
    data-csrf-alt="{$csrf_token}"
    data-csrf2="{$csrfToken}"
    data-userid="<!--{$userID|unescape|escape:'html'}-->"
    data-username="<!--{$name|unescape|escape:'html'}-->"
    style="display: none"
  ></span>

  <div
    id="pmOverdueAlert"
    class="pm-overdueAlert"
    role="alert"
    aria-live="polite"
    aria-atomic="true"
    hidden
  >
    <div class="pm-overdueAlert-inner">
      <span class="pm-overdueAlert-icon material-icons" aria-hidden="true"
        >warning_amber</span
      >
      <div class="pm-overdueAlert-body">
        <p class="pm-overdueAlert-heading" id="pmOverdueAlertHeading"></p>
        <ul class="pm-overdueAlert-list" id="pmOverdueAlertList"></ul>
        <p class="pm-overdueAlert-more" id="pmOverdueAlertMore"></p>
      </div>
      <button
        type="button"
        class="pm-overdueAlert-dismiss"
        id="pmOverdueAlertDismiss"
        aria-label="Dismiss overdue tasks alert"
      >
        <span class="material-icons" aria-hidden="true">close</span>
      </button>
    </div>
  </div>

  <div class="pm-header">
    <h1 class="pm-title">LEAF Project Dashboard</h1>

    <!--{if $empMembership['groupID'][12]}-->
    <!-- LEAF Team user group. Grant team members access to this group to be able to see the action buttons. -->
    <div class="pm-actionsRow pm-actionsRowSpaced">
      <div class="pm-addMenu">
        <button
          type="button"
          class="pm-primaryBtn pm-addBtn"
          id="pmAddMenuBtn"
          aria-haspopup="menu"
          aria-expanded="false"
          aria-controls="pmAddMenuList"
        >
          Add
        </button>
        <div
          class="pm-addMenuPopover"
          id="pmAddMenuList"
          role="menu"
          aria-label="Add menu"
          aria-orientation="vertical"
          hidden
        >
          <button
            type="button"
            class="pm-menuItem"
            role="menuitem"
            data-action="project"
          >
            + Project
          </button>
          <button
            type="button"
            class="pm-menuItem"
            role="menuitem"
            data-action="task"
          >
            + Task
          </button>
          <button
            type="button"
            class="pm-menuItem pm-menuItemTip"
            role="menuitem"
            data-action="recurringTask"
            data-tooltip="One-time setup per task. Once created, the dashboard auto-generates a fresh copy each time that task is completed."
          >
            + Recurring Task
          </button>
          <button
            type="button"
            class="pm-menuItem"
            role="menuitem"
            data-action="objective"
          >
            + Objective
          </button>
          <button
            type="button"
            class="pm-menuItem"
            role="menuitem"
            data-action="keyResult"
          >
            + Key Result
          </button>
        </div>
      </div>
      <div class="pm-inboxWrap">
        <button
          type="button"
          class="pm-primaryBtn pm-inboxBtn"
          id="pmViewInboxBtn"
        >
          View Inbox
        </button>
        <span
          class="pm-inboxBadge"
          id="pmInboxBadge"
          hidden
          aria-label="inbox items"
          aria-live="polite"
          >0</span
        >
      </div>
      <button
        type="button"
        class="pm-primaryBtn pm-inboxBtn"
        id="pmReportBuilderBtn"
      >
        Report Builder
      </button>
      <button
        type="button"
        class="pm-primaryBtn pm-helpBtn"
        id="pmTourBtn"
        aria-label="First time here? Launch a quick interactive tutorial"
        data-tooltip="First time here? Launch a quick interactive tutorial"
      >
        <span class="material-icons" aria-hidden="true">tour</span>
      </button>
    </div>
    <!--{/if}-->

    <div class="pm-controls">
      <div class="pm-centerControls">
        <div class="pm-tabs" role="tablist" aria-label="PM tabs">
          <button
            type="button"
            class="pm-tab"
            data-tab="projects"
            aria-selected="false"
            role="tab"
            aria-controls="pmTab-projects"
            id="pmTabBtn-projects"
            tabindex="-1"
          >
            Projects
          </button>
          <button
            type="button"
            class="pm-tab"
            data-tab="tasks"
            aria-selected="false"
            role="tab"
            aria-controls="pmTab-tasks"
            id="pmTabBtn-tasks"
            tabindex="-1"
          >
            Tasks
          </button>
          <button
            type="button"
            class="pm-tab"
            data-tab="analytics"
            aria-selected="false"
            role="tab"
            aria-controls="pmTab-analytics"
            id="pmTabBtn-analytics"
            tabindex="-1"
          >
            Analytics
          </button>
        </div>

        <div class="pm-filters">
          <label class="pm-label" for="pmSearchInput">Search</label>
          <input id="pmSearchInput" class="pm-input" type="text" value="" />
        </div>
      </div>
    </div>
  </div>

  <section
    id="pmTab-projects"
    class="pm-panel"
    role="tabpanel"
    aria-labelledby="pmTabBtn-projects"
    aria-hidden="true"
  >
    <div class="pm-panelHeader">
      <h2 class="pm-subtitle">Projects</h2>
    </div>
    <div class="pm-filterRow">
      <div class="pm-field pm-filterHeader">
        <div class="pm-filterHeaderLabel">Filter by</div>
      </div>
      <div class="pm-field">
        <label class="pm-label" for="pmProjectFiscalYearSelectToggle"
          >Fiscal Year</label
        >
        <div
          id="pmProjectFiscalYearSelect"
          class="pm-multiSelect"
          data-filter="projectFiscalYear"
        ></div>
      </div>
      <div class="pm-field">
        <label class="pm-label" for="pmProjectOwnerSelectToggle">Owner</label>
        <div
          id="pmProjectOwnerSelect"
          class="pm-multiSelect"
          data-filter="projectOwner"
        ></div>
      </div>
      <div class="pm-field">
        <label class="pm-label" for="pmProjectStatusSelectToggle">Status</label>
        <div
          id="pmProjectStatusSelect"
          class="pm-multiSelect"
          data-filter="projectStatus"
        ></div>
      </div>
      <div class="pm-field">
        <label class="pm-label" for="pmProjectTypeSelectToggle"
          >Project Type</label
        >
        <div
          id="pmProjectTypeSelect"
          class="pm-multiSelect"
          data-filter="projectType"
        ></div>
      </div>
      <div class="pm-field pm-filterHeader pm-activityHeader"></div>
      <div class="pm-field pm-fieldDateRange">
        <span class="pm-filterHeaderLabel">Activity</span>
        <div
          class="pm-dateRangeBtns"
          role="group"
          aria-label="Filter projects by activity date range"
        >
          <button
            type="button"
            class="pm-ghostBtn pm-projDateRangeBtn"
            data-days="7"
            aria-pressed="false"
          >Last 7 days</button>
          <button
            type="button"
            class="pm-ghostBtn pm-projDateRangeBtn"
            data-days="14"
            aria-pressed="false"
          >Last 14 days</button>
          <button
            type="button"
            class="pm-ghostBtn pm-projDateRangeBtn"
            data-days="30"
            aria-pressed="false"
          >Last 30 days</button>
        </div>
      </div>
      <div class="pm-field pm-fieldInlineBtn">
        <button
          type="button"
          class="pm-ghostBtn pm-clearFiltersBtn"
          id="pmClearProjectFilters"
        >
          Clear all filters
        </button>
      </div>
    </div>
    <div class="pm-tableShell">
      <div
        id="pmProjectsTableWrap"
        class="pm-tableWrap"
        tabindex="0"
        aria-label="Projects table"
      >
        <div id="pmProjectsTable"></div>
      </div>
    </div>
    <div
      id="pmProjectsTablePagination"
      class="pm-pagination"
      role="navigation"
      aria-label="Projects table pagination"
    ></div>
  </section>

  <section
    id="pmTab-tasks"
    class="pm-panel"
    role="tabpanel"
    aria-labelledby="pmTabBtn-tasks"
    aria-hidden="true"
  >
    <div class="pm-panelHeader">
      <h2 class="pm-subtitle">Tasks</h2>
    </div>

    <div class="pm-viewRow">
      <div class="pm-viewBtns" role="tablist" aria-label="Tasks view">
        <span class="pm-viewLabel" aria-hidden="true">View:</span>
        <button
          type="button"
          id="pmViewTableBtn"
          class="pm-tab"
          role="tab"
          aria-controls="pmTasksTableWrap"
          aria-selected="false"
          tabindex="-1"
        >
          Task Table
        </button>
        <button
          type="button"
          id="pmViewKanbanBtn"
          class="pm-tab"
          role="tab"
          aria-controls="pmKanbanWrap"
          aria-selected="false"
          tabindex="-1"
        >
          Kanban
        </button>
        <button
          type="button"
          id="pmViewGanttBtn"
          class="pm-tab"
          role="tab"
          aria-controls="pmGanttWrap"
          aria-selected="false"
          tabindex="-1"
        >
          Gantt
        </button>
      </div>
      <div class="pm-viewToggle">
        <label class="pm-switch" for="pmDevOnlyToggle">
          <input type="checkbox" id="pmDevOnlyToggle" class="pm-switchInput" />
          <span class="pm-switchTrack" aria-hidden="true">
            <span class="pm-switchThumb"></span>
          </span>
          <span class="pm-switchLabel">Dev Only</span>
        </label>
      </div>
    </div>

    <div class="pm-filterRow">
      <div class="pm-field pm-filterHeader">
        <div class="pm-filterHeaderLabel">Filter by</div>
      </div>
      <div class="pm-field">
        <label class="pm-label" for="pmProjectKeySelectToggle">Project</label>
        <div
          id="pmProjectKeySelect"
          class="pm-multiSelect"
          data-filter="projectKey"
        ></div>
      </div>

      <div class="pm-field">
        <label class="pm-label" for="pmStatusSelectToggle">Status</label>
        <div
          id="pmStatusSelect"
          class="pm-multiSelect"
          data-filter="status"
        ></div>
      </div>

      <div class="pm-field">
        <label class="pm-label" for="pmAssigneeSelectToggle">Assigned To</label>
        <div
          id="pmAssigneeSelect"
          class="pm-multiSelect"
          data-filter="assignee"
        ></div>
      </div>

      <div class="pm-field">
        <label class="pm-label" for="pmCategorySelectToggle">Category</label>
        <div
          id="pmCategorySelect"
          class="pm-multiSelect"
          data-filter="category"
        ></div>
      </div>

      <div class="pm-field">
        <label class="pm-label" for="pmPrioritySelectToggle">Priority</label>
        <div
          id="pmPrioritySelect"
          class="pm-multiSelect"
          data-filter="priority"
        ></div>
      </div>
      <div class="pm-field pm-filterHeader pm-activityHeader"></div>
      <div class="pm-field pm-fieldDateRange">
        <span class="pm-filterHeaderLabel">Activity</span>
        <div
          class="pm-dateRangeBtns"
          role="group"
          aria-label="Filter by activity date range"
        >
          <button
            type="button"
            class="pm-ghostBtn pm-dateRangeBtn"
            data-days="7"
            aria-pressed="false"
          >
            Last 7 days
          </button>
          <button
            type="button"
            class="pm-ghostBtn pm-dateRangeBtn"
            data-days="14"
            aria-pressed="false"
          >
            Last 14 days
          </button>
          <button
            type="button"
            class="pm-ghostBtn pm-dateRangeBtn"
            data-days="30"
            aria-pressed="false"
          >
            Last 30 days
          </button>
        </div>
      </div>
      <div class="pm-field pm-fieldRecurringToggle">
        <button
          type="button"
          id="pmRecurringFilterBtn"
          class="pm-ghostBtn pm-recurringFilterBtn"
          aria-pressed="false"
          title="Show recurring tasks only"
        >
          <span
            class="material-icons"
            style="font-size: 16px; vertical-align: middle; margin-right: 4px"
            >change_circle</span
          >
          Recurring
        </button>
      </div>
      <div class="pm-field pm-fieldInlineBtn">
        <button
          type="button"
          class="pm-ghostBtn pm-clearFiltersBtn"
          id="pmClearFiltersBtn_tasks"
        >
          Clear all filters
        </button>
      </div>
    </div>

    <div id="pmProjectHealthSticky" class="pm-healthSticky" hidden>
      <div class="pm-healthInner"></div>
    </div>

    <div
      id="pmTasksTableWrap"
      role="tabpanel"
      aria-labelledby="pmViewTableBtn"
      aria-hidden="true"
    >
      <div class="pm-tableShell">
        <div class="pm-tableWrap" tabindex="0" aria-label="Tasks table">
          <div id="pmTasksTable"></div>
        </div>
      </div>
      <div
        id="pmTasksTablePagination"
        class="pm-pagination"
        role="navigation"
        aria-label="Tasks table pagination"
      ></div>
    </div>

    <div
      id="pmKanbanWrap"
      role="tabpanel"
      aria-labelledby="pmViewKanbanBtn"
      aria-hidden="true"
      style="display: none"
    >
      <div class="pm-kanbanHint" id="pmKanbanHint">
        Drag a task card to a new status column to update the task. Keyboard:
        focus a card and press Shift+Left/Right to move it.
      </div>
      <div class="pm-srOnly" id="pmKanbanStatusMsg" aria-live="polite"></div>
      <div id="pmKanbanBoard" class="pm-kanban"></div>
    </div>

    <div
      id="pmGanttWrap"
      role="tabpanel"
      aria-labelledby="pmViewGanttBtn"
      aria-hidden="true"
      style="display: none"
    >
      <div class="pm-ganttMeta" id="pmGanttMeta"></div>
      <div id="pmGanttBoard" class="pm-gantt">
        <div id="pmGanttInner"></div>
      </div>
    </div>
  </section>

  <section
    id="pmTab-analytics"
    class="pm-panel"
    role="tabpanel"
    aria-labelledby="pmTabBtn-analytics"
    aria-hidden="true"
  >
    <h2 class="pm-subtitle">Analytics</h2>
    <div class="pm-viewRow">
      <div class="pm-viewBtns" role="tablist" aria-label="Analytics view">
        <span class="pm-viewLabel" aria-hidden="true">View:</span>
        <button
          type="button"
          id="pmAnalyticsViewMainBtn"
          class="pm-tab"
          role="tab"
          aria-controls="pmAnalyticsWrap"
          aria-selected="false"
          tabindex="-1"
        >
          Project Analytics
        </button>
        <button
          type="button"
          id="pmAnalyticsViewOkrsBtn"
          class="pm-tab"
          role="tab"
          aria-controls="pmOkrsAnalyticsWrap"
          aria-selected="false"
          tabindex="-1"
        >
          OKRs
        </button>
      </div>
    </div>

    <div
      id="pmAnalyticsWrap"
      role="tabpanel"
      aria-labelledby="pmAnalyticsViewMainBtn"
      aria-hidden="true"
    >
      <div class="pm-analyticsFilters">
        <div class="pm-chartControls">
          <label class="pm-label" for="pmAnalyticsGeneralYearSelectToggle"
            >Year</label
          >
          <div
            id="pmAnalyticsGeneralYearSelect"
            class="pm-multiSelect"
            data-filter="analyticsYear"
          ></div>
          <label class="pm-label" for="pmAnalyticsGeneralQuarterSelectToggle">
            Quarter
          </label>
          <div
            id="pmAnalyticsGeneralQuarterSelect"
            class="pm-multiSelect"
            data-filter="analyticsQuarter"
          ></div>
          <button
            type="button"
            class="pm-ghostBtn pm-clearFiltersBtn"
            id="pmAnalyticsClearFiltersBtn"
          >
            Clear all filters
          </button>
        </div>
      </div>

      <div class="pm-analyticsNote">
        Charts are calculated from the same live task records shown in the Tasks
        tab.
      </div>

      <div class="pm-analyticsTables">
        <div class="pm-tableCard">
          <h3 class="pm-chartTitle">Project health rollup</h3>
          <div id="pmProjectHealthTable"></div>
        </div>

        <div class="pm-tableCard">
          <h3 class="pm-chartTitle">Overdue tasks</h3>
          <div id="pmOverdueTasksTable"></div>
        </div>
      </div>

      <div class="pm-analyticsGrid">
        <div class="pm-chartCard">
          <h3 class="pm-chartTitle">Due date buckets</h3>
          <div class="pm-chartBox">
            <div class="pm-chartInner">
              <canvas
                id="pmChartDueBuckets"
                role="img"
                aria-describedby="pmChartDueBucketsDesc"
              ></canvas>
              <div class="pm-srOnly" id="pmChartDueBucketsDesc"></div>
            </div>
          </div>
        </div>

        <div class="pm-chartCard">
          <div class="pm-chartHeader">
            <h3 class="pm-chartTitle">Completed tasks by quarter</h3>
          </div>
          <div class="pm-chartBox">
            <div class="pm-chartInner">
              <canvas
                id="pmChartCompletedByQuarter"
                role="img"
                aria-describedby="pmChartCompletedByQuarterDesc"
              ></canvas>
              <div class="pm-srOnly" id="pmChartCompletedByQuarterDesc"></div>
            </div>
          </div>
        </div>

        <div class="pm-chartCard">
          <div class="pm-chartHeader">
            <h3 class="pm-chartTitle">Completed tasks by category</h3>
          </div>
          <div class="pm-chartBox">
            <div class="pm-chartInner">
              <canvas
                id="pmChartCompletedByCategory"
                role="img"
                aria-describedby="pmChartCompletedByCategoryDesc"
              ></canvas>
              <div class="pm-srOnly" id="pmChartCompletedByCategoryDesc"></div>
            </div>
          </div>
        </div>

        <div class="pm-chartCard">
          <h3 class="pm-chartTitle">Tasks by priority</h3>
          <div class="pm-chartBox">
            <div class="pm-chartInner">
              <canvas
                id="pmChartTasksByPriority"
                role="img"
                aria-describedby="pmChartTasksByPriorityDesc"
              ></canvas>
              <div class="pm-srOnly" id="pmChartTasksByPriorityDesc"></div>
            </div>
          </div>
        </div>

        <div class="pm-chartCard">
          <h3 class="pm-chartTitle">Tasks by Status</h3>
          <div class="pm-chartBox">
            <div class="pm-chartInner">
              <canvas
                id="pmChartTasksByStatus"
                role="img"
                aria-describedby="pmChartTasksByStatusDesc"
              ></canvas>
              <div class="pm-srOnly" id="pmChartTasksByStatusDesc"></div>
            </div>
          </div>
        </div>

        <div class="pm-chartCard">
          <h3 class="pm-chartTitle">Tasks per Project Key</h3>
          <div class="pm-chartBox">
            <div class="pm-chartInner">
              <canvas
                id="pmChartTasksByProject"
                role="img"
                aria-describedby="pmChartTasksByProjectDesc"
              ></canvas>
              <div class="pm-srOnly" id="pmChartTasksByProjectDesc"></div>
            </div>
          </div>
        </div>

        <div class="pm-chartCard">
          <div class="pm-chartHeader">
            <h3 class="pm-chartTitle">Tickets &amp; Projects imported by month</h3>
          </div>
          <div class="pm-chartBox">
            <div class="pm-chartInner">
              <canvas
                id="pmChartTicketsImported"
                role="img"
                aria-describedby="pmChartTicketsImportedDesc"
              ></canvas>
              <div class="pm-srOnly" id="pmChartTicketsImportedDesc"></div>
            </div>
          </div>
        </div>

        <div class="pm-chartCard">
          <h3 class="pm-chartTitle">Projects by Project Type</h3>
          <div class="pm-chartBox">
            <div class="pm-chartInner">
              <canvas
                id="pmChartProjectsByType"
                role="img"
                aria-describedby="pmChartProjectsByTypeDesc"
              ></canvas>
              <div class="pm-srOnly" id="pmChartProjectsByTypeDesc"></div>
            </div>
          </div>
        </div>

        <div class="pm-chartCard">
          <h3 class="pm-chartTitle">Schedule Variance (Days Late/Early)</h3>
          <div class="pm-chartBox">
            <div class="pm-chartInner">
              <canvas
                id="pmChartScheduleVariance"
                role="img"
                aria-describedby="pmChartScheduleVarianceDesc"
              ></canvas>
              <div class="pm-srOnly" id="pmChartScheduleVarianceDesc"></div>
            </div>
          </div>
        </div>
      </div>

      <div id="pmAnalyticsDrilldown" class="pm-analyticsDrilldown" hidden>
        <div class="pm-analyticsDrilldownHeader">
          <div class="pm-analyticsDrilldownMeta">
            <span class="material-icons pm-analyticsDrilldownIcon"></span>
            <span class="pm-analyticsDrilldownTitle"></span>
          </div>
          <button
            type="button"
            class="pm-ghostBtn pm-analyticsDrilldownClose"
            id="pmAnalyticsDrilldownClose"
            aria-label="Close detail panel"
          >
            <span
              class="material-icons"
              style="font-size: 18px; vertical-align: middle"
              >close</span
            >
            Close
          </button>
        </div>
        <div id="pmAnalyticsDrilldownBody"></div>
      </div>
    </div>

    <div
      id="pmOkrsAnalyticsWrap"
      role="tabpanel"
      aria-labelledby="pmAnalyticsViewOkrsBtn"
      aria-hidden="true"
      hidden
    >
      <div id="pmOkrsFilterRow" class="pm-filterRow">
        <div class="pm-field pm-filterHeader">
          <div class="pm-filterHeaderLabel">Filter by</div>
        </div>
        <div class="pm-field">
          <label class="pm-label" for="pmOkrFiscalYearSelectToggle"
            >Fiscal Year</label
          >
          <div
            id="pmOkrFiscalYearSelect"
            class="pm-multiSelect"
            data-filter="okrFiscalYear"
          ></div>
        </div>
        <div class="pm-field pm-fieldInlineBtn">
          <button
            type="button"
            class="pm-ghostBtn pm-clearFiltersBtn"
            id="pmClearFiltersBtn_okrs"
          >
            Clear all filters
          </button>
        </div>
      </div>

      <div
        id="pmOkrQuickView"
        class="pm-okrQuick"
        aria-label="OKR health quick view"
      >
        <div class="pm-okrQuickTitle">OKR Health Quick View</div>
        <div id="pmOkrQuickStats" class="pm-okrQuickStats"></div>
      </div>

      <div id="pmOkrIndex" class="pm-okrIndex" aria-label="OKR index"></div>

      <div id="pmOkrsRollup" class="pm-okrsRollup">
        <div class="pm-okrsHeader">
          <h3 class="pm-okrsTitle">OKR Details</h3>
        </div>
        <div id="pmOkrsSummary" class="pm-okrsSummary"></div>
      </div>

      <div class="pm-okrTableSwitch">
        <div class="pm-viewBtns" role="tablist" aria-label="OKR table view">
          <span class="pm-viewLabel" aria-hidden="true">View:</span>
          <button
            type="button"
            id="pmOkrTableObjectivesBtn"
            class="pm-tab"
            role="tab"
            aria-controls="pmOkrsTableWrap"
            aria-selected="false"
            tabindex="-1"
          >
            Objectives
          </button>
          <button
            type="button"
            id="pmOkrTableKeyResultsBtn"
            class="pm-tab"
            role="tab"
            aria-controls="pmOkrsTableWrap"
            aria-selected="false"
            tabindex="-1"
          >
            Key Results
          </button>
        </div>
      </div>

      <div id="pmOkrsTableWrap">
        <div id="pmOkrsTable"></div>
      </div>
    </div>
  </section>

  <div
    id="pmOtherModal"
    class="pm-modal pm-otherModal"
    aria-hidden="true"
    hidden
  >
    <div class="pm-modalBackdrop" data-close="1"></div>
    <div
      class="pm-otherModalDialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pmOtherModalTitle"
    >
      <div class="pm-otherModalHeader">
        <h2 class="pm-modalTitle" id="pmOtherModalTitle">
          Select Other Status
        </h2>
        <button
          type="button"
          class="pm-modalClose"
          id="pmOtherModalCloseBtn"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div class="pm-otherModalBody">
        <p class="pm-otherModalText">
          Please choose why this task is marked as Other.
        </p>
        <fieldset class="pm-otherModalFieldset">
          <legend class="pm-otherModalLegend">Other status type</legend>
          <label class="pm-otherOption">
            <input
              type="radio"
              name="pmOtherStatus"
              value="Blocked"
              class="pm-otherOptionInput"
            />
            <span class="pm-otherOptionText">Blocked</span>
          </label>
          <label class="pm-otherOption">
            <input
              type="radio"
              name="pmOtherStatus"
              value="On Hold"
              class="pm-otherOptionInput"
            />
            <span class="pm-otherOptionText">On Hold</span>
          </label>
        </fieldset>
      </div>
      <div class="pm-otherModalActions">
        <button type="button" class="pm-ghostBtn" id="pmOtherModalCancelBtn">
          Cancel
        </button>
        <button type="button" class="pm-primaryBtn" id="pmOtherModalConfirmBtn">
          Confirm
        </button>
      </div>
    </div>
  </div>

  <div id="pmModal" class="pm-modal" aria-hidden="true" hidden>
    <div class="pm-modalBackdrop" data-close="1"></div>
    <div
      class="pm-modalDialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pmModalTitle"
    >
      <div class="pm-modalHeader">
        <h2 class="pm-modalTitle" id="pmModalTitle">Details</h2>
        <div class="pm-modalNav" id="pmModalNav" hidden>
          <button
            type="button"
            class="pm-modalNavBtn"
            id="pmModalPrevBtn"
            aria-label="Go back"
            title="Back"
          >
            <span class="material-icons" style="font-size: 18px"
              >chevron_left</span
            >
          </button>
          <span class="pm-modalNavCounter" id="pmModalNavCounter"></span>
          <button
            type="button"
            class="pm-modalNavBtn"
            id="pmModalNextBtn"
            aria-label="Go forward"
            title="Forward"
          >
            <span class="material-icons" style="font-size: 18px"
              >chevron_right</span
            >
          </button>
        </div>
        <div class="pm-modalActions">
          <button
            type="button"
            class="pm-modalOpenTab"
            id="pmModalOpenTabBtn"
            aria-label="Open in new tab"
          >
            Open in new tab
          </button>
          <button
            type="button"
            class="pm-modalClose"
            id="pmModalCloseBtn"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>
      <div class="pm-modalBody">
        <iframe
          id="pmModalFrame"
          class="pm-modalFrame"
          title="LEAF content"
        ></iframe>
      </div>
    </div>
  </div>

  <button
    type="button"
    class="pm-jumpTop"
    id="pmJumpTopBtn"
    aria-label="Back to top"
    aria-hidden="true"
    tabindex="-1"
  >
    ↑
  </button>

  <!-- Feedback widget -->
  <button
    type="button"
    class="pm-feedbackBtn"
    id="pmFeedbackBtn"
    aria-label="Submit feedback"
    aria-haspopup="dialog"
    data-tooltip="Submit your feedback"
  >
    <span class="material-icons" aria-hidden="true">add_reaction</span>
  </button>

  <div
    id="pmFeedbackModal"
    class="pm-feedbackModal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="pmFeedbackModalTitle"
    hidden
  >
    <div class="pm-feedbackInner">
      <div class="pm-feedbackHeader">
        <h2 class="pm-feedbackTitle" id="pmFeedbackModalTitle">
          Submit your feedback for the LEAF Project Dashboard
        </h2>
        <button
          type="button"
          class="pm-feedbackClose"
          id="pmFeedbackClose"
          aria-label="Close feedback"
        >
          ✕
        </button>
      </div>
      <textarea
        id="pmFeedbackText"
        class="pm-feedbackTextarea"
        placeholder="Share your thoughts..."
        rows="5"
        aria-label="Your feedback"
      ></textarea>
      <div class="pm-feedbackFooter">
        <span
          class="pm-feedbackStatus"
          id="pmFeedbackStatus"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        ></span>
        <button type="button" class="pm-primaryBtn" id="pmFeedbackSubmit">
          Submit
        </button>
      </div>
    </div>
  </div>
</div>

<div id="pmTourOverlay" class="pm-tourOverlay" hidden>
  <div id="pmTourSpotlight" class="pm-tourSpotlight"></div>
  <div
    id="pmTourTooltip"
    class="pm-tourTooltip"
    role="dialog"
    aria-modal="true"
    aria-labelledby="pmTourTitle"
  >
    <div id="pmTourStepLabel" class="pm-tourStepLabel" aria-live="polite"></div>
    <div id="pmTourTitle" class="pm-tourTitle"></div>
    <div id="pmTourBody" class="pm-tourBody"></div>
    <div class="pm-tourFooter">
      <button type="button" class="pm-tourSkip" id="pmTourSkip">
        Skip tour
      </button>
      <div class="pm-tourNav">
        <button type="button" class="pm-tourBack" id="pmTourBack">
          ← Back
        </button>
        <button type="button" class="pm-tourNext" id="pmTourNext">
          Next →
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Inline cell editor — singleton overlay, positioned by JS -->
<div
  id="pmInlineEditor"
  class="pm-inlineEditor"
  role="dialog"
  aria-label="Edit cell value"
  hidden
>
  <div class="pm-inlineEditor-inner">
    <div id="pmInlineEditorSkeleton" class="pm-inlineEditor-skeleton" hidden>
      <span class="pm-inlineEditor-skeletonBar"></span>
      <span class="pm-inlineEditor-skeletonBar pm-inlineEditor-skeletonBar--short"></span>
      <span class="pm-inlineEditor-skeletonBar"></span>
    </div>
    <!-- populated dynamically by openInlineEditor() -->
    <div id="pmInlineEditorBody"></div>
    <p class="pm-inlineEditor-hint" id="pmInlineEditorHint"></p>
  </div>
</div>

<!-- Inline editor error popover — repositioned by JS to the offending cell -->
<div id="pmInlineEditorError" class="pm-inlineEditorError" role="alert" hidden>
  <span class="material-icons pm-inlineEditorError-icon" aria-hidden="true">error_outline</span>
  <span id="pmInlineEditorErrorMsg"></span>
</div>

<!-- PERF: Ideally move preconnect + font link to <head> in host template -->
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
<link
  href="https://fonts.googleapis.com/icon?family=Material+Icons"
  rel="stylesheet"
/>
<link rel="stylesheet" href="./files/project_v19.css" />
<link rel="stylesheet" href="./files/project_v16_dark.css" />

<script src="./files/chart.js"></script>
<script src="./files/project_v19.js"></script>
<!--{else}-->
<style>
  /* ── Access Request Landing ─────────────────────────────────────────── */
  #pmAccessRequest {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f4f6f9;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 24px;
    box-sizing: border-box;
  }
  #pmAccessRequest .pm-ar-card {
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    padding: 40px 48px;
    max-width: 480px;
    width: 100%;
    text-align: center;
  }
  #pmAccessRequest .pm-ar-icon {
    font-size: 48px;
    color: #6b7280;
    margin-bottom: 12px;
    display: block;
  }
  #pmAccessRequest h1 {
    font-size: 1.4rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 10px;
  }
  #pmAccessRequest .pm-ar-desc {
    font-size: 0.95rem;
    color: #4b5563;
    line-height: 1.6;
    margin: 0 0 28px;
  }
  #pmAccessRequest .pm-ar-btn {
    width: 100%;
    padding: 11px 20px;
    background: #1a4480;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    box-sizing: border-box;
  }
  #pmAccessRequest .pm-ar-btn:hover { background: #162e51; }

  /* ── Success state ───────────────────────────────────────────────────── */
  #pmAccessRequest .pm-ar-success { text-align: center; }
  #pmAccessRequest .pm-ar-success-icon {
    font-size: 52px;
    color: #16a34a;
    display: block;
    margin-bottom: 12px;
  }
  #pmAccessRequest .pm-ar-success h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 10px;
  }
  #pmAccessRequest .pm-ar-success p {
    font-size: 0.95rem;
    color: #4b5563;
    line-height: 1.6;
    margin: 0;
  }

  /* ── Modal overlay ───────────────────────────────────────────────────── */
  #pmArModal {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0,0,0,0.55);
    align-items: center;
    justify-content: center;
    padding: 24px;
    box-sizing: border-box;
  }
  #pmArModal.is-open { display: flex; }
  #pmArModal .pm-ar-modal-box {
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
    width: 100%;
    max-width: 760px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  #pmArModal .pm-ar-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }
  #pmArModal .pm-ar-modal-title {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }
  #pmArModal .pm-ar-modal-close {
    background: none;
    border: none;
    cursor: pointer;
    color: #6b7280;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 4px;
    font-size: 1.2rem;
    line-height: 1;
  }
  #pmArModal .pm-ar-modal-close:hover { color: #111827; background: #f3f4f6; }
  #pmArModal .pm-ar-modal-frame {
    width: 100%;
    flex: 1;
    border: none;
    min-height: 500px;
  }
</style>

<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />

<!-- Landing card -->
<div id="pmAccessRequest">
  <div class="pm-ar-card">

    <!-- Default state -->
    <div id="pmArDefault">
      <span class="pm-ar-icon material-icons" aria-hidden="true">lock</span>
      <h1>Access Required</h1>
      <p class="pm-ar-desc">
        This dashboard is limited to those who need to know.<br />
        If this applies to you, click below to submit an access request.
      </p>
      <button type="button" class="pm-ar-btn" id="pmArOpenBtn">
        Request Access
      </button>
    </div>

  </div>
</div>

<!-- Modal with LEAF form iframe -->
<div id="pmArModal" role="dialog" aria-modal="true" aria-labelledby="pmArModalTitle">
  <div class="pm-ar-modal-box">
    <div class="pm-ar-modal-header">
      <h2 class="pm-ar-modal-title" id="pmArModalTitle">Request Dashboard Access</h2>
      <button type="button" class="pm-ar-modal-close" id="pmArCloseBtn" aria-label="Close">
        <span class="material-icons" aria-hidden="true">close</span>
      </button>
    </div>
    <iframe
      id="pmArFrame"
      class="pm-ar-modal-frame"
      title="Access Request Form"
      src="about:blank"
    ></iframe>
  </div>
</div>

<script>
(function () {
  var FORM_URL = "https://leaf.va.gov/platform/projects/report.php?a=LEAF_Start_Request&id=form_42704&title=Access+Request&iframe=1";

  var openBtn  = document.getElementById("pmArOpenBtn");
  var closeBtn = document.getElementById("pmArCloseBtn");
  var modal    = document.getElementById("pmArModal");
  var frame    = document.getElementById("pmArFrame");

  function suppressHeader() {
    try {
      var doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
      if (!doc || !doc.head) return;
      if (doc.getElementById("pm-ar-header-suppress")) return;

      var style = doc.createElement("style");
      style.id = "pm-ar-header-suppress";
      // From main.tpl: header is <header id="header">, footer is <footer id="footer">
      // Also hide the nav-skip-link and menu
      style.textContent = [
        "header#header,",
        "#header,",
        "#footer,",
        "#nav-skip-link,",
        "footer { display: none !important; }",
        "body, main#body, #content, #bodyarea {",
        "  margin-top: 0 !important;",
        "  padding-top: 0 !important;",
        "}"
      ].join("\n");
      doc.head.appendChild(style);

      // Also directly hide via JS in case CSS specificity loses
      var ids = ["header", "footer", "nav-skip-link"];
      ids.forEach(function(id) {
        var el = doc.getElementById(id);
        if (el) el.style.setProperty("display", "none", "important");
      });
    } catch(e) {}
  }

  function openModal() {
    frame.src = FORM_URL;
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }

  function closeModal() {
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
    frame.src = "about:blank";
    openBtn.focus();
  }

  frame.addEventListener("load", suppressHeader);

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", function(e) { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });
})();
</script>
<!--{/if}-->
let ideas = [];
let voteCounts = {};
const portalConfig = window.leafIdeaPortal || {};

function sanitizeLeafValue(value) {
  return String(value || "").replace(/<!--|-->/g, "").trim();
}

let userID = sanitizeLeafValue(portalConfig.userID);
let csrfToken = sanitizeLeafValue(portalConfig.csrfToken);
let userVotes = {};
let votingInProgress = false;

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

function bindModalEvents() {
  document.querySelectorAll("[data-ip-open]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.ipOpen));
  });

  document.querySelectorAll("[data-ip-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.ipClose));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".ip-modal.is-open").forEach((modal) => {
      closeModal(modal.id);
    });
  });
}

function bindTabs() {
  $(".ip-tab").on("click", function () {
    const target = $(this).data("ip-tab");

    $(".ip-tab").removeClass("is-active").attr("aria-selected", "false");
    $(this).addClass("is-active").attr("aria-selected", "true");

    $(".ip-panel").removeClass("is-active");
    $(`#panel-${target}`).addClass("is-active");
  });
}

function IdeaVotes(ideanum) {
  if (votingInProgress) return;
  votingInProgress = true;

  userVotes[ideanum] = true;

  $.ajax({
    type: "POST",
    url: "./api/?a=form/new",
    dataType: "json",
    data: {
      service: "",
      title: "Idea #" + ideanum,
      priority: 0,
      numform_7edf3: 1,
      CSRFToken: csrfToken,
      26: userID,
      25: ideanum,
    },
    success: function (response) {
      var recordID = parseFloat(response);
      if (!isNaN(recordID) && isFinite(recordID) && recordID !== 0) {
        alert("Thanks for voting!");
        updateTable();
      } else {
        alert("Error processing vote.");
      }
      votingInProgress = false;
    },
    error: function () {
      alert("Error processing vote.");
      votingInProgress = false;
    },
    cache: false,
  });
}

function attachEventListeners() {
  $(".ip-upvote").off("click");
  $(".ip-share").off("click");

  $(".ip-share").on("click", function () {
    var recordLink = $(this).data("record-link");
    navigator.clipboard.writeText(recordLink).then(
      function () {
        alert("Idea link copied to clipboard.");
      },
      function (err) {
        console.error("Could not copy link: ", err);
      },
    );
  });

  $(".ip-upvote").on("click", function () {
    let ideanum = $(this).data("record-id");
    IdeaVotes(ideanum);
  });
}

function updateTable() {
  $("#results").html("");
  $("#myResults").html("");

  $.ajax({
    url: 'https://leaf.va.gov/VISN20/648/Javascript_Examples/api/form/query/?q={"terms":[{"id":"categoryID","operator":"=","match":"form_a9c92","gate":"AND"},{"id":"deleted","operator":"=","match":0,"gate":"AND"}],"joins":[],"sort":{"id":"created_date","direction":"desc"},"getData":["16","13","20"]}&x-filterData=recordID,title,created_date,userID',
    type: "GET",
    cache: false,
    async: false,
    dataType: "json",
    success: function (data) {
      ideas = Object.values(data);
      fetchVotesData(ideas);
    },
    error: function (xhr, status, error) {
      console.error("AJAX Error: ", status, error);
      $("#results").append("<tr><td colspan='6'>Error loading data</td></tr>");
      $("#myResults").append("<tr><td colspan='5'>Error loading data</td></tr>");
    },
  });
}

function filterIdeasByUser() {
  if (!userID) return [];
  return ideas.filter((idea) => {
    const owner = idea.userID || "";
    return owner === userID;
  });
}

function fetchVotesData(ideas) {
  $.ajax({
    url: 'https://leaf.va.gov/VISN20/648/Javascript_Examples/api/form/query/?q={"terms":[{"id":"categoryID","operator":"=","match":"form_7edf3","gate":"AND"},{"id":"deleted","operator":"=","match":0,"gate":"AND"}],"joins":[],"sort":{},"getData":["25","26"]}&x-filterData=recordID,title',
    type: "GET",
    cache: false,
    async: false,
    dataType: "json",
    success: function (voteData) {
      voteCounts = {};

      Object.values(voteData).forEach((vote) => {
        let ideanum = vote.s1["id25"];
        if (voteCounts[ideanum]) {
          voteCounts[ideanum]++;
        } else {
          voteCounts[ideanum] = 1;
        }
      });

      populateTables(ideas, voteCounts);
      fetchUserSubmissions();
    },
    error: function (xhr, status, error) {
      console.error("AJAX Error: ", status, error);
    },
  });
}

function fetchUserSubmissions() {
  if (!userID) {
    $("#myResults").html("<tr><td colspan='5'>No user ID found</td></tr>");
    return;
  }

  const query = {
    terms: [
      { id: "userID", operator: "=", match: userID, gate: "AND" },
      { id: "categoryID", operator: "=", match: "form_a9c92", gate: "AND" },
      { id: "deleted", operator: "=", match: 0, gate: "AND" },
    ],
    joins: [],
    sort: {},
    getData: ["16", "13", "20"],
  };
  const queryString = encodeURIComponent(JSON.stringify(query));

  $.ajax({
    url: `https://leaf.va.gov/VISN20/648/Javascript_Examples/api/form/query/?q=${queryString}&x-filterData=recordID,title,created_date,userID`,
    type: "GET",
    cache: false,
    async: false,
    dataType: "json",
    success: function (data) {
      let userIdeas = Object.values(data).map((idea) => {
        if (!idea.s1 && idea.recordID) {
          const match = ideas.find((item) => item.recordID === idea.recordID);
          return match ? match : idea;
        }
        return idea;
      });
      if (userIdeas.length === 0) {
        const fallbackIdeas = filterIdeasByUser();
        populateUserSubmissions(fallbackIdeas, voteCounts);
        return;
      }
      populateUserSubmissions(userIdeas, voteCounts);
    },
    error: function (xhr, status, error) {
      console.error("AJAX Error: ", status, error);
      $("#myResults").html(
        "<tr><td colspan='5'>Error loading user ideas</td></tr>",
      );
    },
  });
}

function getStatusBadgeClass(status) {
  switch (status) {
    case "New Submission":
      return "ip-badge--new";
    case "Under Review":
      return "ip-badge--review";
    case "In Progress":
      return "ip-badge--progress";
    case "Completed":
      return "ip-badge--done";
    case "Discarded":
      return "ip-badge--discarded";
    default:
      return "";
  }
}

function getIdeaField(idea, s1Key, fallbackKey) {
  if (idea.s1 && idea.s1[s1Key] !== undefined) {
    return idea.s1[s1Key];
  }
  if (fallbackKey && idea[fallbackKey] !== undefined) {
    return idea[fallbackKey];
  }
  return "";
}

function populateUserSubmissions(userIdeas, voteCounts) {
  if (userIdeas.length === 0) {
    $("#myResults").append("<tr><td colspan='5'>No ideas submitted</td></tr>");
    return;
  }

  userIdeas.forEach((idea) => {
    if (!idea || !idea.recordID) {
      return;
    }
    var recordID = idea.recordID;
    var title = getIdeaField(idea, "id13", "title");
    var category = getIdeaField(idea, "id16", "category");
    var status = getIdeaField(idea, "id20", "status");
    if (status.indexOf("(") >= 0 && status.indexOf(")") >= 0) {
      status = status.replace("(", "").replace(")", "").trim();
    }

    var statusBadgeClass = getStatusBadgeClass(status);
    var votes = voteCounts[recordID] || 0;

    $("#myResults").append(`<tr>
<td><a target='_blank' href='https://leaf.va.gov/VISN20/648/Javascript_Examples/index.php?a=printview&recordID=${recordID}'>${recordID}</a></td>
<td>${title}</td>
<td>${category}</td>
<td><span class="ip-badge ${statusBadgeClass}">${status}</span></td>
<td>${votes}</td>
    </tr>`);
  });
}

function populateTables(ideas, voteCounts) {
  if (ideas.length === 0) {
    $("#results").append("<tr><td colspan='6'>No data found</td></tr>");
  } else {
    ideas.forEach((idea) => {
      var recordID = idea.recordID;
      var title = idea.s1["id13"];
      var category = idea.s1["id16"];
      var status = idea.s1["id20"];
      if (status.indexOf("(") >= 0 && status.indexOf(")") >= 0) {
        status = status.replace("(", "").replace(")", "").trim();
      }

      var statusBadgeClass = getStatusBadgeClass(status);
      var votes = voteCounts[recordID] || 0;
      var actionsCell = `<td class="ip-actionsCell">
<button class='ip-btn ip-btn--ghost ip-upvote' data-record-id='${recordID}'>Upvote</button>
<button class='ip-btn ip-btn--ghost ip-share' data-record-link='https://leaf.va.gov/VISN20/648/Javascript_Examples/index.php?a=printview&recordID=${recordID}'>Share</button>
    </td>`;

      $("#results").append(`<tr>
<td><a target='_blank' href='https://leaf.va.gov/VISN20/648/Javascript_Examples/index.php?a=printview&recordID=${recordID}'>${recordID}</a></td>
<td>${title}</td>
<td>${category}</td>
<td><span class="ip-badge ${statusBadgeClass}">${status}</span></td>
<td>${votes}</td>
${actionsCell}
    </tr>`);
    });
  }

  populateTop10Ideas(voteCounts);
  attachEventListeners();
}

function populateTop10Ideas(voteCounts) {
  $("#topResults").html("");

  let sortedIdeas = ideas.sort((a, b) => {
    let aVotes = voteCounts[a.recordID] || 0;
    let bVotes = voteCounts[b.recordID] || 0;
    return bVotes - aVotes;
  });

  let top10 = sortedIdeas.slice(0, 10);

  if (top10.length === 0) {
    $("#topResults").append("<tr><td colspan='6'>No data found</td></tr>");
  } else {
    top10.forEach((idea) => {
      var recordID = idea.recordID;
      var title = idea.s1["id13"];
      var category = idea.s1["id16"];
      var status = idea.s1["id20"];

      if (status.indexOf("(") >= 0 && status.indexOf(")") >= 0) {
        status = status.replace("(", "").replace(")", "").trim();
      }

      var statusBadgeClass = getStatusBadgeClass(status);
      var votes = voteCounts[recordID] || 0;
      var actionsCell = `<td class="ip-actionsCell">
<button class='ip-btn ip-btn--ghost ip-upvote' data-record-id='${recordID}'>Upvote</button>
<button class='ip-btn ip-btn--ghost ip-share' data-record-link='https://leaf.va.gov/VISN20/648/Javascript_Examples/index.php?a=printview&recordID=${recordID}'>Share</button>
    </td>`;

      $("#topResults").append(`<tr>
<td><a target='_blank' href='https://leaf.va.gov/VISN20/648/Javascript_Examples/index.php?a=printview&recordID=${recordID}'>${recordID}</a></td>
<td>${title}</td>
<td>${category}</td>
<td><span class="ip-badge ${statusBadgeClass}">${status}</span></td>
<td>${votes}</td>
${actionsCell}
    </tr>`);
    });
  }

  attachEventListeners();
}

$(document).ready(function () {
  bindModalEvents();
  bindTabs();
  updateTable();

  $("#fileInput").on("change", function () {
    var files = this.files;
    handleFiles(files);
  });

  function handleFiles(files) {
    var fileList = $("#fileList");
    fileList.empty();
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var listItem = $("<li>").text(file.name);
      fileList.append(listItem);
    }
  }

  $("#searchInput").on("input", function () {
    var searchValue = $(this).val().toLowerCase();
    filterIdeas(searchValue);
  });

  function filterIdeas(searchValue) {
    $("#results tr").filter(function () {
      $(this).toggle($(this).text().toLowerCase().indexOf(searchValue) > -1);
    });
  }

  (function () {
    "use strict";

    var forms = document.querySelectorAll(".needs-validation");
    Array.prototype.slice.call(forms).forEach(function (form) {
      form.addEventListener(
        "submit",
        function (event) {
          if (!form.checkValidity()) {
            event.preventDefault();
            event.stopPropagation();
          } else {
            event.preventDefault();
            if (typeof NewIdea === "function") {
              NewIdea();
            }
          }
          form.classList.add("was-validated");
        },
        false,
      );
    });
  })();
});

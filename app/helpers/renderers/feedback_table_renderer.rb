class FeedbackTableRenderer
  include ApplicationHelper

  require 'builder'

  @renderers = [FeedbackTableRenderer]

  def self.inherited(cl)
    @renderers << cl
  end

  class << self
    attr_reader :renderers
  end

  def initialize(submission, user)
    result = submission.safe_result(user)
    @submission = result.present? ? JSON.parse(result, symbolize_names: true) : nil
    @current_user = user
    @course = submission.course
    @builder = Builder::XmlMarkup.new
    @code = submission.code
    @exercise = submission.exercise
    @exercise_id = submission.exercise_id
    @programming_language = submission.exercise.programming_language&.editor_name
  end

  def parse
    if @submission.present?
      @builder.div(class: 'feedback-table', "data-exercise_id": @exercise_id) do
        if @submission[:messages].present?
          @builder.div(class: 'row feedback-table-messages') do
            messages(@submission[:messages])
          end
        end
        tabs(@submission)
        init_js
      end.html_safe
    else
      @builder.div(class: 'feedback-table', "data-exercise_id": @exercise_id) do
        @builder.div(class: 'row feedback-table-messages') do
          messages([{ description: I18n.t('submissions.show.reading_failed'), format: 'plain' }])
        end
      end.html_safe
    end
  end

  def show_code_tab
    true
  end

  def show_diff_type_switch(tab)
    tab[:groups]&.compact # Groups
        &.flat_map { |t| t[:groups] }&.compact # Testcases
        &.flat_map { |t| t[:tests] }&.compact # Tests
        &.reject { |t| t[:accepted] }
        &.any?
  end

  def show_hide_correct_switch(tab)
    tests = tab[:groups]&.compact
    tests&.reject { |t| t[:accepted] }&.any? && tests&.select { |t| t[:accepted] }&.any?
  end

  def tabs(submission)
    @builder.div(class: 'card-tab') do
      @builder.ul(class: 'nav nav-tabs') do
        submission[:groups]&.each_with_index do |t, i|
          @builder.li(class: ('active' if i.zero?)) do
            @builder.a(href: "##{(t[:description] || 'test').parameterize}-#{i}", 'data-toggle': 'tab') do
              @builder.text!((t[:description] || 'Test').upcase_first + ' ')
              @builder.span(class: 'badge') do
                @builder << tab_count(t)
              end
            end
          end
        end
        if show_code_tab
          @builder.li(class: ('active' if submission[:groups].blank?)) do
            @builder.a(href: '#code-tab', 'data-toggle': 'tab') do
              @builder.text!(I18n.t('submissions.show.code') + ' ')
              if submission.key?(:annotations) && submission[:annotations].count.positive?
                @builder.span(class: 'badge') do
                  @builder << submission[:annotations].count.to_s
                end
              end
            end
          end
        end
      end
      @builder.div(class: 'tab-content') do
        @submission[:groups].each_with_index { |t, i| tab(t, i) } if submission[:groups]
        if show_code_tab
          @builder.div(class: "tab-pane #{'active' if submission[:groups].blank?}", id: 'code-tab') do
            if submission[:annotations]
              @builder.div(class: 'linter') do
                source(@code, submission[:annotations])
              end
            else
              source(@code, [])
            end
          end
        end
      end
    end
  end

  def tab_count(t)
    return '' if t[:badgeCount].nil?
    return '' if t[:badgeCount].zero?
    return '' if t[:badgeCount] == '0'

    t[:badgeCount].to_s
  end

  def tab(t, i)
    @builder.div(class: "tab-pane #{'active' if i.zero?}", id: "#{(t[:description] || 'test').parameterize}-#{i}") do
      tab_content(t)
    end
  end

  def tab_content(t)
    @diff_type = determine_tab_diff_type(t)
    show_hide_correct = show_hide_correct_switch t
    show_diff_type = show_diff_type_switch t
    if show_hide_correct || show_diff_type
      @builder.div(class: 'feedback-table-options') do
        @builder.span(class: 'flex-spacer') {}
        if show_hide_correct
          @builder.span(class: 'correct-switch-buttons switch-buttons') do
            @builder.span do
              @builder << I18n.t('submissions.show.correct_tests')
            end
            @builder.div(class: 'btn-group btn-toggle') do
              @builder.button(class: 'btn btn-secondary active', 'data-show': 'true', title: I18n.t('submissions.show.correct.shown'), 'data-toggle': 'tooltip', 'data-placement': 'top') do
                @builder.i('', class: 'mdi mdi-eye mdi-18')
              end
              @builder.button(class: 'btn btn-secondary ', 'data-show': 'false', title: I18n.t('submissions.show.correct.hidden'), 'data-toggle': 'tooltip', 'data-placement': 'top') do
                @builder.i('', class: 'mdi mdi-eye-off mdi-18')
              end
            end
          end
        end
        if show_diff_type
          @builder.span(class: 'diff-switch-buttons switch-buttons') do
            @builder.span do
              @builder << I18n.t('submissions.show.output')
            end
            @builder.div(class: 'btn-group btn-toggle') do
              @builder.button(class: "btn btn-secondary #{@diff_type == 'split' ? 'active' : ''}", 'data-show_class': 'show-split', title: I18n.t('submissions.show.diff.split'), 'data-toggle': 'tooltip', 'data-placement': 'top') do
                @builder.i(class: 'mdi mdi-18 mdi-arrow-split-vertical') {}
              end
              @builder.button(class: "btn btn-secondary #{@diff_type == 'unified' ? 'active' : ''}", 'data-show_class': 'show-unified', title: I18n.t('submissions.show.diff.unified'), 'data-toggle': 'tooltip', 'data-placement': 'top') do
                @builder.i(class: 'mdi mdi-18 mdi-arrow-split-horizontal') {}
              end
            end
          end
        end
      end
    end
    messages(t[:messages])
    @builder.div(class: 'groups') do
      t[:groups]&.each { |g| group(g) }
    end
  end

  def group(g)
    @builder.div(class: "row group #{g[:accepted] ? 'correct' : 'wrong'}") do
      if g[:description]
        @builder.div(class: 'col-xs-12 description') do
          message(g[:description])
        end
      end
      messages(g[:messages])
      g[:groups]&.each { |tc| testcase(tc) }
    end
  end

  def testcase_icons(tc); end

  def testcase(tc)
    @builder.div(class: "testcase #{tc[:accepted] ? 'correct' : 'wrong'}") do
      testcase_content(tc)
    end
  end

  def testcase_content(tc)
    @builder.div(class: 'col-xs-12 description') do
      @builder.div(class: 'indicator') do
        testcase_icons(tc)
        tc[:accepted] ? icon_correct : icon_wrong
      end
      message(tc[:description]) if tc[:description]
    end
    tc[:tests]&.each { |t| test(t) }
    @builder.div(class: 'col-xs-12') do
      messages(tc[:messages])
    end
  end

  def test(t)
    @builder.div(class: 'col-xs-12 test') do
      if t[:description]
        @builder.div(class: 'description') do
          message(t[:description])
        end
      elsif t[:data]&.fetch(:channel, nil)
        @builder.div(class: 'description') do
          @builder.span(class: "label label-#{t[:accepted] ? 'success' : 'danger'}") do
            @builder << t[:data][:channel]
          end
        end
      end
      if t[:accepted]
        test_accepted(t)
      else
        test_failed(t)
      end
      messages(t[:messages])
    end
  end

  def messages(msgs)
    return if msgs.blank?

    @builder.div(class: 'messages') do
      msgs.each do |msg|
        @builder.div(class: 'message') do
          message(msg)
        end
      end
    end
  end

  def test_accepted(t)
    @builder.div(class: 'test-accepted') do
      @builder.span(t[:generated], class: 'output')
    end
  end

  def test_failed(t)
    @builder.div(class: 'test-failed') do
      diff(t)
    end
  end

  def diff(t)
    @builder.div(class: "diffs show-#{@diff_type}") do
      diff_split(t)
      diff_unified(t)
    end
  end

  def diff_unified(t)
    @builder << LCSHtmlDiffer.new(t[:generated], t[:expected]).unified
  end

  def diff_split(t)
    @builder << LCSHtmlDiffer.new(t[:generated], t[:expected]).split
  end

  def message(m)
    return if m.nil?

    m = { format: 'plain', description: m } if m.is_a? String
    output_message(m)
  end

  def output_message(m)
    if m[:format].in?(%w[plain text])
      @builder.text! m[:description]
    elsif m[:format].in?(%w[html])
      @builder << m[:description]
    elsif m[:format].in?(%w[markdown md])
      @builder << markdown(m[:description])
    elsif m[:format].in?(%w[callout])
      @builder.div(class: 'callout callout-info') do
        @builder << markdown(m[:description])
      end
    elsif m[:format].in?(%w[code])
      @builder.span(class: 'code') do
        @builder.text! m[:description]
      end
    else
      @builder.span(class: "code highlighter-rouge #{m[:format]}") do
        formatter = Rouge::Formatters::HTML.new(wrap: false)
        lexer = (Rouge::Lexer.find(m[:format].downcase) || Rouge::Lexers::PlainText).new
        @builder << formatter.format(lexer.lex(m[:description]))
      end
    end
  end

  def format_lint_message(message)
    lines = message.split("\n")
    @builder.text! lines[0]
    return unless lines.length > 1

    @builder.br
    @builder.div(class: 'code') do
      @builder.text! lines.drop(1).join("\n")
    end
  end

  def source(code, messages)
    if messages.present?
      @builder.ul(class: 'lint-errors') do
        messages.each do |m|
          @builder.li(class: 'lint-msg') do
            send('icon_' + m[:type])
            @builder.text! "#{I18n.t('submissions.show.line')} #{m[:row] + 1}: "
            format_lint_message(m[:text])
          end
        end
      end
    end
    @builder.div(id: 'editor-result') do
      @builder.text! code
    end
    @builder << "<script>$(function () {dodona.loadResultEditor('#{@programming_language || 'text'}', #{messages.to_json});});</script>"
  end

  def init_js
    @builder.script do
      @builder << 'dodona.initSubmissionShow();'
    end
  end

  def determine_tab_diff_type(tab)
    tab[:groups]&.each do |group|
      group[:groups]&.each do |testcase|
        testcase[:tests]&.each do |test|
          return 'unified' if determine_diff_type(test) == 'unified'
        end
      end
    end
    'split'
  end

  def determine_diff_type(test)
    output = (test[:expected].to_s || '') + "\n" + (test[:generated].to_s || '')
    if output.split("\n", -1).map(&:length).max < 55
      'split'
    else
      'unified'
    end
  end

  def icon_testcase
    @builder.span('► ', class: 'testcase-icon')
  end

  def icon_correct
    @builder.i('', class: 'mdi mdi-check mdi-18')
  end

  def icon_wrong
    @builder.i('', class: 'mdi-close mdi mdi-18')
  end

  def icon_warning
    @builder.i('', class: 'mdi mdi-alert mdi-18')
  end

  def icon_error
    @builder.i('', class: 'mdi mdi-alert-circle mdi-18')
  end

  def icon_info
    @builder.i('', class: 'mdi mdi-alert-circle mdi-18')
  end
end
